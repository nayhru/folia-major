// src/services/lyricEnrichment/scripts.ts
// Which writing a lyric line is in, as far as romanization cares. A song is judged as a whole:
// kanji are also Chinese characters, so a Han-only line of a song that has kana anywhere is
// Japanese, and Chinese only in a song without any.

export type RomanizableLanguage = 'ja' | 'zh' | 'ko';

const KANA = /[぀-ヿㇰ-ㇿｦ-ﾟ]/;
const HAN = /[㐀-䶿一-鿿豈-﫿]/;
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;

/** Whether any of these lines is written in kana: the song is then Japanese. */
export const songHasKana = (texts: readonly string[]): boolean => texts.some(text => KANA.test(text));

/** The language a line is romanized from, or null for a line with nothing to romanize. */
export const lineLanguage = (text: string, songIsJapanese: boolean): RomanizableLanguage | null => {
    if (HANGUL.test(text)) return 'ko';
    if (KANA.test(text)) return 'ja';
    if (HAN.test(text)) return songIsJapanese ? 'ja' : 'zh';
    return null;
};
