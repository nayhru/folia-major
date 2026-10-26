'use strict';

const path = require('node:path');

// electron/lyricEnrichment/japaneseReadings.cjs
// The readings of Japanese lyric lines, for the romanization the window adds to lyrics that came
// without one (src/services/lyricEnrichment/). Kanji has no reading of its own, so a line is cut
// into words by kuromoji with its IPA dictionary (17 MB, read from the package on first use, about
// half a second) and each word comes back with its reading in katakana. Turning katakana into
// romaji is the window's part: wanakana is bundled there, not here.
//
// Only the main process can read the dictionary from disk; the web build has no Japanese
// romanization.

const MAX_LINES = 400;
const MAX_LINE_CHARS = 500;

let building = null;

/** The kuromoji tokenizer, built once; a failed build is tried again on the next call. */
function tokenizer({ load = () => require('kuromoji') } = {}) {
  if (!building) {
    building = new Promise((resolve, reject) => {
      const kuromoji = load();
      const dicPath = path.join(path.dirname(require.resolve('kuromoji/package.json')), 'dict');
      kuromoji.builder({ dicPath }).build((error, built) => (error ? reject(error) : resolve(built)));
    }).catch((error) => {
      building = null;
      throw error;
    });
  }
  return building;
}

/**
 * Each line as its words: `{ s, r, p, d }` is the text, its reading in katakana (null for a word the
 * dictionary does not know, such as a word in Latin letters), its part of speech and the first
 * detail of it, both in the dictionary's Japanese terms.
 */
async function readLines(lines, options) {
  const built = await tokenizer(options);
  return lines.map(line => built.tokenize(line).map(token => ({
    s: token.surface_form,
    r: token.reading && token.reading !== '*' ? token.reading : null,
    p: token.pos,
    d: token.pos_detail_1,
  })));
}

function registerLyricEnrichmentIpc({ ipcMain, isTrustedMainWindowContents }) {
  ipcMain.handle('lyric-japanese-readings', async (event, lines) => {
    if (!isTrustedMainWindowContents(event.sender)) return null;
    if (!Array.isArray(lines) || lines.length > MAX_LINES) return null;
    const texts = lines.map(line => String(line ?? '').slice(0, MAX_LINE_CHARS));
    try {
      return await readLines(texts);
    } catch (error) {
      console.warn('[LyricEnrichment] Japanese readings failed:', error instanceof Error ? error.message : String(error));
      return null;
    }
  });
}

module.exports = { registerLyricEnrichmentIpc, readLines };
