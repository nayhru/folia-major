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
];
