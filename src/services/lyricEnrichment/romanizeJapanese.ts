import { toRomaji } from 'wanakana';

// src/services/lyricEnrichment/romanizeJapanese.ts
// Japanese to romaji. The words of each line and their readings come from the main process
// (electron/lyricEnrichment/japaneseReadings.cjs: kanji cannot be read without a dictionary);
// this turns the katakana readings into romaji and spaces the words the way romanized lyrics are
// usually written: endings and helper verbs stay joined to the word they follow (yonde ita), the
// particles は, へ and を are written as they are said (wa, e, o).

export interface JapaneseWord {
    /** The word as written. */
    s: string;
    /** Its reading in katakana; null for a word the dictionary does not know (Latin letters, say). */
    r: string | null;
    /** Part of speech and its first detail, in the dictionary's terms. */
    p: string;
    d: string;
}

const SPOKEN_PARTICLES: Record<string, string> = { は: 'wa', へ: 'e', を: 'o' };

/**
 * Written onto the word before it, without a space. A helper verb such as いる keeps its own word
 * (yonde ita), as romanized lyrics usually write it.
 */
const joinsPrevious = (word: JapaneseWord): boolean => (
    word.p === '助動詞'
    || word.p === '記号'
    || (word.p === '助詞' && word.d === '接続助詞')
    || word.d === '接尾'
);

export function romajiOfWords(words: readonly JapaneseWord[]): string {
    let out = '';
    for (const word of words) {
        if (word.p === '記号' && word.d === '空白') {
            if (out && !out.endsWith(' ')) out += ' ';
            continue;
        }
        const spoken = word.p === '助詞' ? SPOKEN_PARTICLES[word.s] : undefined;
        const romaji = spoken ?? toRomaji(word.r ?? word.s);
        if (!romaji) continue;
        out += out && !out.endsWith(' ') && !joinsPrevious(word) ? ` ${romaji}` : romaji;
    }
    return out.trim();
}

/** Romaji for each line, in order; null when the readings could not be had (the web build, a failure). */
export async function romanizeJapanese(texts: readonly string[]): Promise<string[] | null> {
    const readings = await window.electron?.getJapaneseLyricReadings?.([...texts]).catch(() => null);
    if (!readings || readings.length !== texts.length) return null;
    return readings.map(romajiOfWords);
}
