import { describe, expect, it } from 'vitest';
import type { Line } from '@/types';
import { retimedWords, withMainText } from '@/services/lyricEnrichment/mainText';

const line = (fullText: string, extra: Partial<Line> = {}): Line => ({ fullText, words: [], startTime: 10, endTime: 14, ...extra });

describe('the main lyric text', () => {
    it('leaves the lines as they are for the original', () => {
        const lines = [line('君が好き', { romanization: 'kimi ga suki' })];
        expect(withMainText(lines, 'original')).toBe(lines);
    });

    it('draws the romanization as the lyric and moves the original to the romanization', () => {
        const [shown] = withMainText([line('君が好き', { romanization: 'kimi ga suki', translation: 'Me gustas', autoWordSegments: ['君', 'が', '好き'] })], 'romanization');
        expect(shown.fullText).toBe('kimi ga suki');
        expect(shown.romanization).toBe('君が好き');
        expect(shown.translation).toBe('Me gustas');
        expect(shown.autoWordSegments).toBeUndefined();
    });

    it('draws the translation as the lyric and moves the original to the translation', () => {
        const [shown] = withMainText([line('君が好き', { translation: 'Me gustas' })], 'translation');
        expect(shown.fullText).toBe('Me gustas');
        expect(shown.translation).toBe('君が好き');
    });

    it('keeps a line without the chosen text, and returns the same array when no line changes', () => {
        const lines = [line('♪'), line('Oh yeah', { translation: 'Oh yeah' })];
        expect(withMainText(lines, 'translation')).toBe(lines);
    });
});

describe('retimedWords', () => {
    it('spreads the sung time over the new words by their length', () => {
        const original = line('君が好き', {
            words: [{ text: '君が', startTime: 10, endTime: 11 }, { text: '好き', startTime: 11, endTime: 13 }],
        });
        expect(retimedWords(original, 'ab cd')).toEqual([
            { text: 'ab ', startTime: 10, endTime: 11.5 },
            { text: 'cd', startTime: 11.5, endTime: 13 },
        ]);
    });

    it('keeps a line timed by line only without words', () => {
        expect(retimedWords(line('君が好き'), 'kimi ga suki')).toEqual([]);
    });
});
