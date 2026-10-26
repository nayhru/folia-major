import type { Line, Word } from '../../types';

// src/services/lyricEnrichment/mainText.ts
// Which text the lyric styles draw as the lyric itself: the original, its romanization or its
// translation. The two swap places on screen only (useVisualizerRendererModel): a line shown in
// romaji carries the original as its romanization, one shown translated carries it as its
// translation, so the subtitle shows the original. The lyrics in the store keep the original as
// they are, which romanization and translation are worked out from and kept by.
//
// A line without the chosen text is drawn as it is.

export type LyricMainText = 'original' | 'romanization' | 'translation';

const alternateOf = (line: Line, role: 'romanization' | 'translation'): string | null => {
    const direct = role === 'romanization' ? line.romanization : line.translation;
    return direct?.trim() || line.alternateTexts?.find(entry => entry.role === role && entry.text.trim())?.text.trim() || null;
};

/**
 * The words of `text` timed over the time the line's words were sung, each word's share by its
 * length, so a style that reveals word by word keeps moving with the song. A line timed by line
 * only (no words) stays so.
 */
export function retimedWords(line: Line, text: string): Word[] {
    if (!line.words.length) return [];
    const start = Number.isFinite(line.words[0].startTime) ? line.words[0].startTime : line.startTime;
    const lastEnd = line.words[line.words.length - 1].endTime;
    const end = Number.isFinite(lastEnd) && lastEnd > start ? lastEnd : line.endTime;
    const pieces = text.match(/\S+\s*/gu) ?? [text];
    const total = pieces.reduce((sum, piece) => sum + piece.trim().length, 0) || 1;
    let sung = 0;
    return pieces.map(piece => {
        const from = start + (end - start) * (sung / total);
        sung += piece.trim().length;
        return { text: piece, startTime: from, endTime: start + (end - start) * (sung / total) };
    });
}

function swapLine(line: Line, mode: Exclude<LyricMainText, 'original'>): Line {
    const shown = alternateOf(line, mode);
    if (!shown || shown === line.fullText.trim()) return line;
    return {
        ...line,
        fullText: shown,
        words: retimedWords(line, shown),
        // Word boundaries belong to the original text.
        wordSegments: undefined,
        autoWordSegments: undefined,
        romanization: mode === 'romanization' ? line.fullText : line.romanization,
        translation: mode === 'translation' ? line.fullText : line.translation,
        alternateTexts: line.alternateTexts?.filter(entry => entry.role !== mode),
    };
}

/** The lines as the styles draw them; the same array for the original, or when no line changes. */
export function withMainText(lines: Line[], mode: LyricMainText): Line[] {
    if (mode === 'original') return lines;
    let changed = false;
    const next = lines.map(line => {
        const swapped = swapLine(line, mode);
        if (swapped !== line) changed = true;
        return swapped;
    });
    return changed ? next : lines;
}
