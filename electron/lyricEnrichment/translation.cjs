'use strict';

// electron/lyricEnrichment/translation.cjs
// Translates a song's lyric lines into the language of the interface with the model the user set
// up for AI themes (electron/aiTextClient.cjs), for lyrics whose source gave no translation the
// listener can read (src/services/lyricEnrichment/translation.ts). The whole song goes in one ask,
// so each line is translated knowing the others; the answer is one string per line, in order.
//
// It asks as the segmentation task: a JSON answer with reasoning switched off, which is what a line
// by line translation needs, and the provider adapters already know how to ask for it.

const SCHEMA_NAME = 'lyric_translation';
const JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    translations: { type: 'array', items: { type: 'string' } },
  },
  required: ['translations'],
};
const GEMINI_SCHEMA = {
  type: 'OBJECT',
  properties: {
    translations: {
      type: 'ARRAY',
      description: 'One entry per input line, in order: its translation, or an empty string.',
      items: { type: 'STRING' },
    },
  },
  required: ['translations'],
};
const MAX_OUTPUT_TOKENS = 8192;
const MAX_LINES = 300;
const MAX_LINE_CHARS = 300;

// The language the translation is written in, named for the model.
const LANGUAGES = Object.freeze({
  es: "neutral Latin American Spanish, addressing the listener as 'tú' (never 'vos')",
  en: 'English',
  in: 'Indonesian',
  'zh-CN': 'Simplified Chinese',
  'zh-TW': 'Traditional Chinese',
});

const systemPrompt = language => [
  `You translate song lyrics into ${language} for subtitles shown under each line while the song plays.`,
  '',
  'You receive the numbered lines of one song. Return exactly one translation per line, in the same order.',
  'Rules:',
  '1. Translate meaning, mood and imagery naturally, the way a fan subtitler would; keep it short enough to read while the line is sung.',
  '2. Read the whole song first: a line may continue the one before it.',
  '3. Return an empty string for a line already written in the target language, and for a line that is only sounds or vocalizations (oh, la la, yeah).',
  '4. Keep names, brands and words the song uses in another language on purpose (an English hook in a Japanese song) as the song writes them, unless translating them reads better.',
  '5. No notes, no quotes around lines, no romanization, no explanations.',
].join('\n');

const sourcePrompt = lines => lines.map((line, index) => `${index + 1}. ${line}`).join('\n');

// A service that is busy for now (Gemini's 503 "high demand", a rate limit, a gateway error) is
// asked again after these waits; one still busy after them is said to be busy, not failed.
const BUSY_RETRY_MS = [2000, 6000];
const isBusy = message => /\b(429|500|502|503|504)\b|UNAVAILABLE|RESOURCE_EXHAUSTED|overloaded|high demand/i.test(message);
const wait = ms => new Promise(resolve => { setTimeout(resolve, ms); });

/** The translations from the model's answer, one per line; throws on an answer of another shape. */
function parseTranslations(raw, count) {
  const text = String(raw ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(text);
  const list = Array.isArray(parsed?.translations) ? parsed.translations : null;
  if (!list || list.length !== count) {
    throw new Error(`The model answered ${list ? list.length : 'no'} translations for ${count} lines`);
  }
  return list.map(entry => (typeof entry === 'string' ? entry.trim() : ''));
}

/**
 * Registers `translate-lyrics`: `(lines, language)` resolves to `{ translations }`, `{ busy: true }`
 * when the service stayed busy, or `{ error }`, the error being words the window may show.
 */
function registerLyricTranslationIpc({ ipcMain, isTrustedMainWindowContents, store, aiCredentials, runAiJsonCompletion, fetchWithOptionalSystemProxy, pause = wait }) {
  ipcMain.handle('translate-lyrics', async (event, lines, languageKey) => {
    if (!isTrustedMainWindowContents(event.sender)) return { error: 'Not allowed' };
    const language = LANGUAGES[languageKey];
    if (!language || !Array.isArray(lines) || lines.length === 0 || lines.length > MAX_LINES) return { error: 'Nothing to translate' };
    const texts = lines.map(line => String(line ?? '').slice(0, MAX_LINE_CHARS));
    const useSystemProxy = store.get('USE_SYSTEM_PROXY_FOR_AI') || false;
    console.log(`[LyricEnrichment] translating ${texts.length} lines into ${languageKey} via ${store.get('AI_PROVIDER') || 'gemini'}`);
    for (let attempt = 0; ; attempt++) {
      try {
        const raw = await runAiJsonCompletion({
          store: aiCredentials.settingsView,
          task: 'segmentation',
          systemPrompt: systemPrompt(language),
          sourcePrompt: sourcePrompt(texts),
          schema: JSON_SCHEMA,
          schemaName: SCHEMA_NAME,
          geminiSchema: GEMINI_SCHEMA,
          customFetch: (url, options) => fetchWithOptionalSystemProxy(url, options, useSystemProxy),
          answerTokens: MAX_OUTPUT_TOKENS,
        });
        return { translations: parseTranslations(raw, texts.length) };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (isBusy(message) && attempt < BUSY_RETRY_MS.length) {
          console.warn(`[LyricEnrichment] the AI service is busy; asking again in ${BUSY_RETRY_MS[attempt]}ms`);
          await pause(BUSY_RETRY_MS[attempt]);
          continue;
        }
        console.warn('[LyricEnrichment] translation failed:', message.split('\n')[0]);
        return isBusy(message) ? { busy: true } : { error: message.split('\n')[0] };
      }
    }
  });
}

module.exports = { registerLyricTranslationIpc, parseTranslations, systemPrompt, isBusy, LANGUAGES };
