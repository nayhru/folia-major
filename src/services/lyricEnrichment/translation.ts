import type { Line, LyricData } from '../../types';
import { getFromCache, saveToCache } from '../db';
import { isChineseText } from '../../utils/lyrics/hideChineseTranslations';

// src/services/lyricEnrichment/translation.ts
// A translation into the interface language for lyrics whose source gave none the listener can
// read. Outside a Chinese interface a Chinese translation counts as none: the visualizer hides it
// (utils/lyrics/hideChineseTranslations.ts), so the AI one takes its place.
//
// A translation costs a request to the user's AI service, so each one is kept in the app's cache
// by the lyric text and the language, not by song: the same lyrics from another source or after a
// restart are not asked for again. The cache key starts with `lyricTrans_`, which no cache category
// sweeps (see services/lyricSegmentation.ts), so clearing the lyric cache does not throw them away.

export type TranslationLanguage = 'es' | 'en' | 'in' | 'zh-CN' | 'zh-TW';

const CACHE_PREFIX = 'lyricTrans_';
const HAS_LETTERS = /\p{L}/u;

/** The interface language to translate into, or null for one the translation does not serve. */
export const translationLanguageOf = (uiLanguage: string | undefined): TranslationLanguage | null => {
    const lowered = String(uiLanguage || '').toLowerCase();
    if (lowered.startsWith('es')) return 'es';
    if (lowered.startsWith('en')) return 'en';
    if (lowered === 'in' || lowered.startsWith('id')) return 'in';
    if (lowered === 'zh-tw' || lowered === 'zh-hk' || lowered.includes('hant')) return 'zh-TW';
    if (lowered.startsWith('zh')) return 'zh-CN';
    return null;
};

const readableTranslation = (line: Line, language: TranslationLanguage): string | null => {
    const text = line.translation?.trim() || line.alternateTexts?.find(entry => entry.role === 'translation' && entry.text.trim())?.text.trim();
    if (!text) return null;
    return language.startsWith('zh') || !isChineseText(text) ? text : null;
};

/**
 * The lines to send for translation, once each, in song order; empty when the lyrics need none (the
 * source gave a readable translation for some line, or no line has words).
 */
export function linesToTranslate(lyrics: LyricData | null, language: TranslationLanguage): string[] {
    if (!lyrics?.lines.length || lyrics.lines.some(line => readableTranslation(line, language))) return [];
    const texts: string[] = [];
    for (const line of lyrics.lines) {
        const text = line.fullText.trim();
        if (text && HAS_LETTERS.test(text) && !texts.includes(text)) texts.push(text);
    }
    return texts;
}

const digest = async (text: string): Promise<string> => {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 32);
};

export const translationCacheKey = async (texts: readonly string[], language: TranslationLanguage): Promise<string> => (
    `${CACHE_PREFIX}${language}_${await digest(texts.join('\n'))}`
);

/** Kept translations: line text -> its translation ('' for a line the model left untranslated). */
export type TranslationTable = Record<string, string>;

export const loadTranslation = async (key: string): Promise<TranslationTable | null> => {
    const cached = await getFromCache<unknown>(key);
    return cached && typeof cached === 'object' && !Array.isArray(cached) ? cached as TranslationTable : null;
};

export const saveTranslation = (key: string, table: TranslationTable): Promise<void> => saveToCache(key, table);

/** The AI service was still busy after the main process asked again: worth another try later. */
export class TranslationBusyError extends Error {
    constructor() {
        super('busy');
        this.name = 'TranslationBusyError';
    }
}

/**
 * Asks the main process for the translation of these lines. Resolves to the table, or throws
 * TranslationBusyError, or an error with words the listener may be shown.
 */
export async function requestTranslation(texts: readonly string[], language: TranslationLanguage): Promise<TranslationTable> {
    const translate = window.electron?.translateLyrics;
    if (!translate) throw new Error('unavailable');
    const answer = await translate([...texts], language);
    if ('busy' in answer) throw new TranslationBusyError();
    if ('error' in answer) throw new Error(answer.error);
    return Object.fromEntries(texts.map((text, index) => [text, answer.translations[index] ?? '']));
}

/**
 * The lyrics with the table's translation on each line it has one for, in place of none or of a
 * translation the listener cannot read; the same object when nothing changes. A translation equal to
 * the line itself (a line already in the language) is not added.
 */
export function withTranslation(lyrics: LyricData, table: TranslationTable, language: TranslationLanguage): LyricData {
    let changed = false;
    const lines = lyrics.lines.map(line => {
        const translated = table[line.fullText.trim()]?.trim();
        if (!translated || translated.toLocaleLowerCase() === line.fullText.trim().toLocaleLowerCase()) return line;
        if (readableTranslation(line, language)) return line;
        changed = true;
        return {
            ...line,
            translation: translated,
            alternateTexts: line.alternateTexts?.filter(entry => entry.role !== 'translation'),
        };
    });
    return changed ? { ...lyrics, lines } : lyrics;
}
