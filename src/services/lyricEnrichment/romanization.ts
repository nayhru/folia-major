import type { LyricData } from '../../types';
import { romanizeChinese } from './romanizeChinese';
import { romanizeJapanese } from './romanizeJapanese';
import { romanizeKorean } from './romanizeKorean';
import { lineLanguage, songHasKana, type RomanizableLanguage } from './scripts';

// src/services/lyricEnrichment/romanization.ts
// Romanization for lyrics that came without one: a platform whose lyrics are plain text, a local
// .lrc, a stage source. Lyrics whose source gave any romanization are left as they are:
// the source's is better than a computed one, and mixing the two in one song would show.
//
// A line's romanization depends on its text and the song's language only, so it is kept by both
// for the rest of the run and a song played again costs nothing.

const romanized = new Map<string, string>();
const keyOf = (language: RomanizableLanguage, text: string) => `${language}\u0000${text}`;

const hasSourceRomanization = (lyrics: LyricData): boolean => lyrics.lines.some(line => (
    Boolean(line.romanization?.trim())
    || Boolean(line.alternateTexts?.some(entry => entry.role === 'romanization' && entry.text.trim()))
));

/** The lines still to romanize, by language; empty when there is nothing to add. */
export function linesToRomanize(lyrics: LyricData | null): Map<RomanizableLanguage, string[]> {
    const wanted = new Map<RomanizableLanguage, string[]>();
    if (!lyrics?.lines.length || hasSourceRomanization(lyrics)) return wanted;
    const songIsJapanese = songHasKana(lyrics.lines.map(line => line.fullText));
    for (const line of lyrics.lines) {
        const language = lineLanguage(line.fullText, songIsJapanese);
        if (!language || romanized.has(keyOf(language, line.fullText))) continue;
        const list = wanted.get(language) ?? [];
        if (!list.includes(line.fullText)) list.push(line.fullText);
        wanted.set(language, list);
    }
    return wanted;
}

/** Computes and keeps the romanization of these lines. A language that fails keeps nothing. */
export async function romanizeLines(wanted: Map<RomanizableLanguage, string[]>): Promise<void> {
    await Promise.all([...wanted].map(async ([language, texts]) => {
        const results = language === 'ko'
            ? texts.map(romanizeKorean)
            : language === 'zh'
                ? await romanizeChinese(texts).catch(() => null)
                : await romanizeJapanese(texts);
        results?.forEach((result, index) => {
            if (result) romanized.set(keyOf(language, texts[index]), result);
        });
    }));
}

/**
 * The lyrics with the kept romanization on each line that has none; the same object when nothing
 * changes, so the caller can tell a no-op apart.
 */
export function withRomanization(lyrics: LyricData): LyricData {
    if (hasSourceRomanization(lyrics)) return lyrics;
    const songIsJapanese = songHasKana(lyrics.lines.map(line => line.fullText));
    let changed = false;
    const lines = lyrics.lines.map(line => {
        const language = lineLanguage(line.fullText, songIsJapanese);
        const result = language ? romanized.get(keyOf(language, line.fullText)) : undefined;
        if (!result || result === line.fullText) return line;
        changed = true;
        return { ...line, romanization: result };
    });
    return changed ? { ...lyrics, lines } : lyrics;
}
