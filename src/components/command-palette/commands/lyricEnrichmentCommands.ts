import { Languages } from 'lucide-react';
import type { CommandPaletteCommand } from '../types';
import { createToggleCommand } from '../commandFactories';
import { useLyricEnrichmentStore } from '../../../services/lyricEnrichment/lyricEnrichmentStore';
import { setStatusMessage } from '../../../stores/useStatusMessageStore';

// src/components/command-palette/commands/lyricEnrichmentCommands.ts
// The switch of what Folia adds to lyrics that came without it (src/services/lyricEnrichment/),
// beside its row on the 歌词 settings page.

export const lyricEnrichmentCommands: CommandPaletteCommand[] = [
    createToggleCommand(
        'lyric-auto-romanization-toggle',
        'settings',
        'Add romanization',
        'Turn on or off romanizing Japanese, Korean and Chinese lyrics that come without romanization',
        ['romanization', 'romaji', 'romanize', 'japanese', 'korean', 'chinese', '罗马音', '注音', '拼音', 'romanisasi', 'romanización'],
        context => {
            const store = useLyricEnrichmentStore.getState();
            store.toggleAutoRomanization();
            const enabled = useLyricEnrichmentStore.getState().autoRomanization;
            setStatusMessage({
                type: 'info',
                text: context.shared.t(enabled ? 'status.autoRomanizationOn' : 'status.autoRomanizationOff'),
            });
        },
        { icon: Languages },
    ),
    createToggleCommand(
        'lyric-auto-translation-toggle',
        'settings',
        'Translate lyrics with AI',
        'Turn on or off translating lyrics without a translation into the interface language with your AI model',
        ['translate lyrics', 'lyrics translation', 'ai translation', 'translator', '翻译歌词', 'AI翻译', 'terjemahkan lirik', 'traducir letras'],
        context => {
            const store = useLyricEnrichmentStore.getState();
            store.toggleAutoTranslation();
            const enabled = useLyricEnrichmentStore.getState().autoTranslation;
            setStatusMessage({
                type: 'info',
                text: context.shared.t(enabled ? 'status.autoTranslationOn' : 'status.autoTranslationOff'),
            });
        },
        { platform: ['electron'], icon: Languages },
    ),
    createToggleCommand(
        'lyric-main-text-cycle',
        'settings',
        'Cycle the main lyric text',
        'Draw the lyric itself as the original, its romanization or its translation; the original moves to the subtitle',
        ['main lyric', 'lyric text', 'show romaji', 'show translation', 'swap lyrics', '主歌词', '显示罗马音', '显示翻译', 'lirik utama', 'letra principal'],
        context => {
            const next = useLyricEnrichmentStore.getState().cycleMainText();
            setStatusMessage({ type: 'info', text: context.shared.t(`status.lyricMainText_${next}`) });
        },
        { icon: Languages },
    ),
];
