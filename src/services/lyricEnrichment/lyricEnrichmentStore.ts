import { create } from 'zustand';
import { getStoredBoolean, getStoredString, setStoredBoolean, setStoredString } from '../../stores/storagePrimitives';
import type { LyricMainText } from './mainText';

// src/services/lyricEnrichment/lyricEnrichmentStore.ts
// Whether Folia adds what the lyrics' source did not give. Stored on this device. Romanization is
// worked out on the device and starts on; translation asks the user's AI service and starts off.
// The main text is which of the original, its romanization and its translation the styles draw.

const AUTO_ROMANIZATION_KEY = 'lyric_auto_romanization';
const AUTO_TRANSLATION_KEY = 'lyric_auto_translation';
const MAIN_TEXT_KEY = 'lyric_main_text';
const MAIN_TEXTS: readonly LyricMainText[] = ['original', 'romanization', 'translation'];
const readMainText = (): LyricMainText => {
    const stored = getStoredString(MAIN_TEXT_KEY, 'original');
    return (MAIN_TEXTS as readonly string[]).includes(stored) ? stored as LyricMainText : 'original';
};

interface LyricEnrichmentState {
    autoRomanization: boolean;
    autoTranslation: boolean;
    mainText: LyricMainText;
    setAutoRomanization: (enabled: boolean) => void;
    toggleAutoRomanization: () => void;
    setAutoTranslation: (enabled: boolean) => void;
    toggleAutoTranslation: () => void;
    setMainText: (mainText: LyricMainText) => void;
    /** The next main text after this one, in the order original, romanization, translation. */
    cycleMainText: () => LyricMainText;
}

export const useLyricEnrichmentStore = create<LyricEnrichmentState>((set, get) => ({
    autoRomanization: getStoredBoolean(AUTO_ROMANIZATION_KEY, true),
    autoTranslation: getStoredBoolean(AUTO_TRANSLATION_KEY, false),
    mainText: readMainText(),
    setAutoRomanization: (enabled) => {
        setStoredBoolean(AUTO_ROMANIZATION_KEY, enabled);
        set({ autoRomanization: enabled });
    },
    toggleAutoRomanization: () => get().setAutoRomanization(!get().autoRomanization),
    setAutoTranslation: (enabled) => {
        setStoredBoolean(AUTO_TRANSLATION_KEY, enabled);
        set({ autoTranslation: enabled });
    },
    toggleAutoTranslation: () => get().setAutoTranslation(!get().autoTranslation),
    setMainText: (mainText) => {
        setStoredString(MAIN_TEXT_KEY, mainText);
        set({ mainText });
    },
    cycleMainText: () => {
        const next = MAIN_TEXTS[(MAIN_TEXTS.indexOf(get().mainText) + 1) % MAIN_TEXTS.length];
        get().setMainText(next);
        return next;
    },
}));
