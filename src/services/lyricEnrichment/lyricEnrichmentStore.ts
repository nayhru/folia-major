import { create } from 'zustand';
import { getStoredBoolean, setStoredBoolean } from '../../stores/storagePrimitives';

// src/services/lyricEnrichment/lyricEnrichmentStore.ts
// Whether Folia adds what the lyrics' source did not give. Stored on this device. Romanization is
// worked out on the device and starts on; translation asks the user's AI service and starts off.

const AUTO_ROMANIZATION_KEY = 'lyric_auto_romanization';
const AUTO_TRANSLATION_KEY = 'lyric_auto_translation';

interface LyricEnrichmentState {
    autoRomanization: boolean;
    autoTranslation: boolean;
    setAutoRomanization: (enabled: boolean) => void;
    toggleAutoRomanization: () => void;
    setAutoTranslation: (enabled: boolean) => void;
    toggleAutoTranslation: () => void;
}

export const useLyricEnrichmentStore = create<LyricEnrichmentState>((set, get) => ({
    autoRomanization: getStoredBoolean(AUTO_ROMANIZATION_KEY, true),
    autoTranslation: getStoredBoolean(AUTO_TRANSLATION_KEY, false),
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
}));
