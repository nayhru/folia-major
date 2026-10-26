import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import type { LyricData } from '@/types';
import { linesToTranslate, translationCacheKey, translationLanguageOf, withTranslation } from '@/services/lyricEnrichment/translation';

const require = createRequire(import.meta.url);
const { parseTranslations, registerLyricTranslationIpc, systemPrompt, isBusy, LANGUAGES } = require('../../../electron/lyricEnrichment/translation.cjs');

const lyricsOf = (...texts: string[]): LyricData => ({
    lines: texts.map((fullText, index) => ({ fullText, words: [], startTime: index, endTime: index + 1 })),
});

describe('the language a translation is written in', () => {
    it('follows the interface language', () => {
        expect(translationLanguageOf('es')).toBe('es');
        expect(translationLanguageOf('en-US')).toBe('en');
        expect(translationLanguageOf('in')).toBe('in');
        expect(translationLanguageOf('zh-TW')).toBe('zh-TW');
        expect(translationLanguageOf('zh-CN')).toBe('zh-CN');
        expect(translationLanguageOf('fr')).toBeNull();
    });

    it('asks for Spanish with tú, never vos', () => {
        expect(systemPrompt(LANGUAGES.es)).toContain("'tú' (never 'vos')");
    });
});

describe('which lines are sent', () => {
    it('sends each line with words once, in song order', () => {
        expect(linesToTranslate(lyricsOf('君が好き', '♪', '君が好き', 'Oh yeah'), 'es')).toEqual(['君が好き', 'Oh yeah']);
    });

    it('sends nothing when the source gave a translation the listener can read', () => {
        const lyrics = lyricsOf('君が好き', '夜空');
        lyrics.lines[0].translation = 'I love you';
        expect(linesToTranslate(lyrics, 'es')).toEqual([]);
    });

    it('treats a Chinese translation as none outside a Chinese interface', () => {
        const lyrics = lyricsOf('君が好き');
        lyrics.lines[0].translation = '我喜欢你';
        expect(linesToTranslate(lyrics, 'es')).toEqual(['君が好き']);
        expect(linesToTranslate(lyrics, 'zh-CN')).toEqual([]);
    });
});

describe('adding the translation', () => {
    it('puts it on the lines it has, in place of a Chinese one, and skips a line left as it was', () => {
        const lyrics = lyricsOf('君が好き', 'Te quiero', 'ラララ');
        lyrics.lines[0].translation = '我喜欢你';
        const table = { 君が好き: 'Me gustas', 'Te quiero': 'te quiero', ラララ: '' };
        const done = withTranslation(lyrics, table, 'es');
        expect(done.lines.map(line => line.translation)).toEqual(['Me gustas', undefined, undefined]);
        expect(withTranslation(done, table, 'es')).toBe(done);
    });

    it('keys the kept translation by the lyric text and the language', async () => {
        const key = await translationCacheKey(['a', 'b'], 'es');
        expect(key).toMatch(/^lyricTrans_es_[0-9a-f]{32}$/);
        expect(await translationCacheKey(['a', 'b'], 'en')).not.toBe(key);
        expect(await translationCacheKey(['a', 'b'], 'es')).toBe(key);
    });
});

describe('the answer of the model', () => {
    it('reads one translation per line, also inside a code fence', () => {
        expect(parseTranslations('```json\n{"translations":[" Hola ",""]}\n```', 2)).toEqual(['Hola', '']);
    });

    it('refuses an answer with another number of lines', () => {
        expect(() => parseTranslations('{"translations":["Hola"]}', 2)).toThrow(/1 translations for 2 lines/);
    });
});

describe('a busy AI service', () => {
    const handlerWith = (answers: Array<string | Error>, provider = 'openai') => {
        const handlers: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
        const calls: number[] = [];
        const models: unknown[] = [];
        registerLyricTranslationIpc({
            ipcMain: { handle: (name: string, handler: (...args: unknown[]) => Promise<unknown>) => { handlers[name] = handler; } },
            isTrustedMainWindowContents: () => true,
            store: { get: (key: string) => (key === 'AI_PROVIDER' ? provider : undefined) },
            aiCredentials: { settingsView: { get: () => undefined } },
            runAiJsonCompletion: async ({ store }: { store: { get: (key: string) => unknown } }) => {
                calls.push(1);
                models.push(store.get('GEMINI_API_MODEL'));
                const next = answers.shift();
                if (next instanceof Error) throw next;
                return next;
            },
            fetchWithOptionalSystemProxy: () => undefined,
            pause: async () => {},
        });
        return { translate: (lines: string[]) => handlers['translate-lyrics']({ sender: {} }, lines, 'es'), calls, models };
    };
    const busy = () => new Error('Gemini API error: 503 Service Unavailable - {\n  "status": "UNAVAILABLE"');

    it('tells a busy answer apart from another failure', () => {
        expect(isBusy(busy().message)).toBe(true);
        expect(isBusy('API key not valid')).toBe(false);
    });

    it('asks again while the service is busy, and answers when it is not', async () => {
        const { translate, calls } = handlerWith([busy(), busy(), '{"translations":["Hola"]}']);
        expect(await translate(['こんにちは'])).toEqual({ translations: ['Hola'] });
        expect(calls).toHaveLength(3);
    });

    it('on Gemini, tries the stable light models once each when the one set up stays busy', async () => {
        const gemini = handlerWith([busy(), busy(), busy(), new Error('404 model not found'), '{"translations":["Hola"]}'], 'gemini');
        expect(await gemini.translate(['a'])).toEqual({ translations: ['Hola'] });
        expect(gemini.models).toEqual([undefined, undefined, undefined, 'gemini-flash-lite-latest', 'gemini-flash-latest']);
    });

    it('says busy when the service stays busy, and gives other failures their first line', async () => {
        expect(await handlerWith([busy(), busy(), busy()]).translate(['a'])).toEqual({ busy: true });
        expect(await handlerWith([new Error('API key not valid\nmore')]).translate(['a'])).toEqual({ error: 'API key not valid' });
    });
});
