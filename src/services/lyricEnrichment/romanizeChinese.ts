// src/services/lyricEnrichment/romanizeChinese.ts
// Chinese to pinyin with tone marks, one syllable per character; letters, digits and punctuation
// stay as they are. pinyin-pro carries a dictionary of its own (polyphones are read from the words
// around them), so it is loaded only when a Chinese song asks for it.

let loading: Promise<typeof import('pinyin-pro')> | null = null;

export async function romanizeChinese(texts: readonly string[]): Promise<string[]> {
    loading ??= import('pinyin-pro');
    const { pinyin } = await loading;
    return texts.map(text => pinyin(text, { toneType: 'symbol', type: 'array', nonZh: 'consecutive' })
        .map(part => part.trim())
        .filter(Boolean)
        .join(' ')
        .replace(/ ([,.!?;:，。！？；：、)\]」』])/g, '$1')
        .replace(/([(\[「『]) /g, '$1'));
}
