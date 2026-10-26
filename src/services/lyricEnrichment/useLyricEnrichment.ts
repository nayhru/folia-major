import { useEffect } from 'react';
import { reworkShownLyrics } from '../../components/app/playback/createLyricsSetter';
import { setLyricsState, usePlaybackStore } from '../../stores/usePlaybackStore';
import { useLyricEnrichmentStore } from './lyricEnrichmentStore';
import { linesToRomanize, romanizeLines, withRomanization } from './romanization';

// src/services/lyricEnrichment/useLyricEnrichment.ts
// Adds romanization to the lyrics on screen once it is computed, the way the saved word
// segmentation is added (hooks/useLyricWordSegmentation.ts): onto the lyrics before the extension
// transform, through reworkShownLyrics, so nothing of the lyric pipeline runs twice. The lyrics
// that come back carry romanization on every line it could be had for, so the next run of this
// effect finds nothing to do and stops there.

export function useLyricEnrichment() {
    const lyrics = usePlaybackStore(state => state.lyrics);
    const autoRomanization = useLyricEnrichmentStore(state => state.autoRomanization);

    useEffect(() => {
        if (!autoRomanization || !lyrics) return;
        const wanted = linesToRomanize(lyrics);
        let cancelled = false;
        void (wanted.size ? romanizeLines(wanted) : Promise.resolve()).then(() => {
            if (cancelled) return;
            // Lyrics of another song that arrived meanwhile are romanized from what is kept too:
            // withRomanization only adds what is kept for each line's own text.
            setLyricsState(previous => reworkShownLyrics(previous, withRomanization));
        });
        return () => {
            cancelled = true;
        };
    }, [lyrics, autoRomanization]);
}
