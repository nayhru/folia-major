import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import type { LyricData } from '@/types';
import { romanizeKorean } from '@/services/lyricEnrichment/romanizeKorean';
import { romanizeChinese } from '@/services/lyricEnrichment/romanizeChinese';
import { romajiOfWords } from '@/services/lyricEnrichment/romanizeJapanese';
import { lineLanguage, songHasKana } from '@/services/lyricEnrichment/scripts';
import { linesToRomanize, romanizeLines, withRomanization } from '@/services/lyricEnrichment/romanization';

const require = createRequire(import.meta.url);
const { readLines } = require('../../../electron/lyricEnrichment/japaneseReadings.cjs');

const lyricsOf = (...texts: string[]): LyricData => ({
    lines: texts.map((fullText, index) => ({ fullText, words: [], startTime: index, endTime: index + 1 })),
});

describe('which language a line is romanized from', () => {
    it('takes a Han-only line as Japanese in a song with kana, and as Chinese otherwise', () => {
        expect(songHasKana(['夜空', 'きみの声'])).toBe(true);
        expect(lineLanguage('夜空', true)).toBe('ja');
        expect(lineLanguage('夜空', false)).toBe('zh');
        expect(lineLanguage('사랑해', false)).toBe('ko');
        expect(lineLanguage('Hello world', true)).toBeNull();
    });
});

describe('romanizeKorean', () => {
    it('romanizes syllable by syllable, carrying a final into a silent initial', () => {
        expect(romanizeKorean('안녕하세요')).toBe('annyeonghaseyo');
        expect(romanizeKorean('음악')).toBe('eumak');
        expect(romanizeKorean('사랑해 너를')).toBe('saranghae neoreul');
        expect(romanizeKorean('좋아')).toBe('joa');
    });

    it('writes ㄹ after ㄹ or ㄴ as ll, and keeps what is not Hangul', () => {
        expect(romanizeKorean('달력')).toBe('dallyeok');
        expect(romanizeKorean('신라')).toBe('silla');
        expect(romanizeKorean('Baby 사랑')).toBe('Baby sarang');
    });
});

describe('romanizeChinese', () => {
    it('gives pinyin with tone marks, keeping letters and closing punctuation in place', async () => {
        expect(await romanizeChinese(['我爱你', '你好, world!'])).toEqual(['wǒ ài nǐ', 'nǐ hǎo, world!']);
    });
});

describe('Japanese romaji', () => {
    it('joins endings to their word and writes は, を as said, from the readings of the main process', async () => {
        const [words] = await readLines(['君の名前を呼んでいた']);
        expect(romajiOfWords(words)).toBe('kimi no namae o yonde ita');
        const [tokyo] = await readLines(['東京は夜の七時']);
        expect(romajiOfWords(tokyo)).toBe('toukyou wa yoru no nanaji');
    });

    it('keeps words the dictionary does not know as written', async () => {
        const [words] = await readLines(['Hello 世界']);
        expect(romajiOfWords(words)).toBe('Hello sekai');
    });
});

describe('adding romanization to lyrics', () => {
    it('leaves lyrics alone when their source gave any romanization', () => {
        const lyrics = lyricsOf('사랑해', '보고 싶어');
        lyrics.lines[0].romanization = 'saranghae';
        expect(linesToRomanize(lyrics).size).toBe(0);
        expect(withRomanization(lyrics)).toBe(lyrics);
    });

    it('fills the lines it can and returns the same object when there is nothing to add', async () => {
        const lyrics = lyricsOf('사랑해', 'Oh baby');
        await romanizeLines(linesToRomanize(lyrics));
        const done = withRomanization(lyrics);
        expect(done.lines.map(line => line.romanization)).toEqual(['saranghae', undefined]);
        expect(withRomanization(lyricsOf('Oh baby'))).toEqual(lyricsOf('Oh baby'));
        expect(linesToRomanize(done).size).toBe(0);
    });
});
