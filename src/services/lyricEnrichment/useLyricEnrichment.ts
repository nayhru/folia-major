import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { reworkShownLyrics } from '../../components/app/playback/createLyricsSetter';
import { setLyricsState, usePlaybackStore } from '../../stores/usePlaybackStore';
import { setStatusMessage } from '../../stores/useStatusMessageStore';
import { useLyricEnrichmentStore } from './lyricEnrichmentStore';
import { linesToRomanize, romanizeLines, withRomanization } from './romanization';
import {
    linesToTranslate, loadTranslation, requestTranslation, saveTranslation, translationCacheKey, translationLanguageOf,
    TranslationBusyError, withTranslation, type TranslationTable,
} from './translation';

// src/services/lyricEnrichment/useLyricEnrichment.ts
// Adds romanization and a translation to the lyrics on screen once they are had, the way the saved
// word segmentation is added (hooks/useLyricWordSegmentation.ts): onto the lyrics before the
// extension transform, through reworkShownLyrics, so nothing of the lyric pipeline runs twice. The
// lyrics that come back carry what could be had, so the next run of each effect finds nothing to
// do and stops there.

// A translation asked for once per lyric text and language in a run: a request already on its way
// is shared, and one that failed is not asked again until the app restarts or the switch is turned
// on again, so a missing key does not send a request on every lyric change. A service that was only
// busy is asked again the next time these lyrics are loaded.
const translating = new Map<string, Promise<TranslationTable>>();
const failed = new Set<string>();

const translationOf = (key: string, texts: string[], language: Parameters<typeof requestTranslation>[1]): Promise<TranslationTable> => {
    let pending = translating.get(key);
    if (!pending) {
        pending = (async () => {
            const kept = await loadTranslation(key);
            if (kept) return kept;
            const table = await requestTranslation(texts, language);
            await saveTranslation(key, table);
            return table;
        })().finally(() => translating.delete(key));
        translating.set(key, pending);
    }
    return pending;
};

export function useLyricEnrichment() {
    const { t, i18n } = useTranslation();
    const lyrics = usePlaybackStore(state => state.lyrics);
    const autoRomanization = useLyricEnrichmentStore(state => state.autoRomanization);
    const autoTranslation = useLyricEnrichmentStore(state => state.autoTranslation);
    const uiLanguage = i18n.resolvedLanguage ?? i18n.language;

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

    useEffect(() => {
        if (autoTranslation) failed.clear();
    }, [autoTranslation]);

    useEffect(() => {
        const language = translationLanguageOf(uiLanguage);
        if (!autoTranslation || !lyrics || !language) return;
        const texts = linesToTranslate(lyrics, language);
        if (!texts.length) return;
        let cancelled = false;
        void (async () => {
            const key = await translationCacheKey(texts, language);
            if (cancelled || failed.has(key)) return;
            try {
                const table = await translationOf(key, texts, language);
                if (cancelled) return;
                setLyricsState(previous => reworkShownLyrics(previous, source => withTranslation(source, table, language)));
            } catch (error) {
                if (error instanceof TranslationBusyError) {
                    if (!cancelled) setStatusMessage({ type: 'info', text: t('status.lyricTranslationBusy') });
                    return;
                }
                failed.add(key);
                if (cancelled) return;
                const message = error instanceof Error ? error.message : String(error);
                console.warn('[LyricEnrichment] translation failed:', message);
                setStatusMessage({ type: 'error', text: t('status.lyricTranslationFailed', { error: message }) });
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [lyrics, autoTranslation, uiLanguage, t]);
}
