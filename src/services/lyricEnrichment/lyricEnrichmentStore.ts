import { create } from 'zustand';
import { getStoredBoolean, setStoredBoolean } from '../../stores/storagePrimitives';

// src/services/lyricEnrichment/lyricEnrichmentStore.ts
// Whether Folia adds what the lyrics' source did not give. Stored on this device.

const AUTO_ROMANIZATION_KEY = 'lyric_auto_romanization';

interface LyricEnrichmentState {
    autoRomanization: boolean;
    setAutoRomanization: (enabled: boolean) => void;
    toggleAutoRomanization: () => void;
}

export const useLyricEnrichmentStore = create<LyricEnrichmentState>((set, get) => ({
    autoRomanization: getStoredBoolean(AUTO_ROMANIZATION_KEY, true),
    setAutoRomanization: (enabled) => {
        setStoredBoolean(AUTO_ROMANIZATION_KEY, enabled);
        set({ autoRomanization: enabled });
    },
    toggleAutoRomanization: () => get().setAutoRomanization(!get().autoRomanization),
}));
