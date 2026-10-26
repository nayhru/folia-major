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

// A drawn-out vowel (わー, うそー) the dictionary leaves as a word of its own.
const LONG_MARK = /^[ーｰ〜～]+$/;

/** The words with each lone long-vowel mark joined onto the word before it, so it lengthens that vowel. */
const withLongMarksJoined = (words: readonly JapaneseWord[]): JapaneseWord[] => words.reduce<JapaneseWord[]>((joined, word) => {
    const previous = joined.at(-1);
    if (previous && LONG_MARK.test(word.s) && previous.p !== '記号') {
        joined[joined.length - 1] = { ...previous, s: previous.s + word.s, r: (previous.r ?? previous.s) + word.s };
    } else {
        joined.push(word);
    }
    return joined;
}, []);

export function romajiOfWords(words: readonly JapaneseWord[]): string {
    let out = '';
    // After an opening bracket the next word follows it without a space.
    let afterOpening = false;
    for (const word of withLongMarksJoined(words)) {
        if (word.p === '記号' && word.d === '空白') {
            if (out && !out.endsWith(' ')) out += ' ';
            continue;
        }
        const spoken = word.p === '助詞' ? SPOKEN_PARTICLES[word.s] : undefined;
        const romaji = spoken ?? toRomaji(word.r ?? word.s);
        if (!romaji) continue;
        const opening = word.p === '記号' && word.d === '括弧開';
        const spaced = out && !out.endsWith(' ') && !afterOpening && (opening || !joinsPrevious(word));
        out += spaced ? ` ${romaji}` : romaji;
        afterOpening = opening;
    }
    return out.trim();
}

/** Romaji for each line, in order; null when the readings could not be had (the web build, a failure). */
export async function romanizeJapanese(texts: readonly string[]): Promise<string[] | null> {
    const readings = await window.electron?.getJapaneseLyricReadings?.([...texts]).catch(() => null);
    if (!readings || readings.length !== texts.length) return null;
    return readings.map(romajiOfWords);
}
