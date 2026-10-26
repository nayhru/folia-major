// src/services/lyricEnrichment/romanizeKorean.ts
// Hangul to Latin letters by the Revised Romanization of Korean, with the sound changes a listener
// hears most: a final consonant moves to a following syllable that starts silent (음악 eumak), and
// ㄹ meeting ㄹ or ㄴ is "ll". Other assimilations (국민 gungmin) are left as written, which keeps
// every syllable recognisable. Hangul needs no dictionary: each syllable block is computed into
// its initial, vowel and final.

const INITIALS = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];
const VOWELS = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'];
// A final as it sounds at the end of a syllable.
const FINALS = ['', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'k', 'm', 'l', 'l', 'l', 'p', 'l', 'm', 'p', 'p', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 't'];
// A final carried over to a following silent initial: [what stays, what moves].
const CARRIED: Array<[string, string]> = [
    ['', ''], ['', 'g'], ['', 'kk'], ['k', 's'], ['', 'n'], ['n', 'j'], ['', 'n'], ['', 'd'], ['', 'r'], ['l', 'g'], ['l', 'm'],
    ['l', 'b'], ['l', 's'], ['l', 't'], ['l', 'p'], ['', 'r'], ['', 'm'], ['', 'b'], ['p', 's'], ['', 's'], ['', 'ss'], ['ng', ''],
    ['', 'j'], ['', 'ch'], ['', 'k'], ['', 't'], ['', 'p'], ['', ''],
];

const FIRST = 0xac00;
const LAST = 0xd7a3;
const SILENT = 11;
const RIEUL = 5;
const FINAL_NIEUN = 4;
const FINAL_RIEUL = 8;

interface Syllable { initial: number; vowel: number; final: number }

const decompose = (char: string): Syllable | null => {
    const code = char.charCodeAt(0);
    if (code < FIRST || code > LAST) return null;
    const index = code - FIRST;
    return { initial: Math.floor(index / 588), vowel: Math.floor((index % 588) / 28), final: index % 28 };
};

export function romanizeKorean(text: string): string {
    const chars = [...text];
    let out = '';
    for (let i = 0; i < chars.length; i++) {
        const syllable = decompose(chars[i]);
        if (!syllable) {
            out += chars[i];
            continue;
        }
        const previous = i > 0 ? decompose(chars[i - 1]) : null;
        const next = i + 1 < chars.length ? decompose(chars[i + 1]) : null;
        // The initial, unless the previous syllable's final has already moved into its place.
        let initial = INITIALS[syllable.initial];
        if (previous && previous.final && syllable.initial === SILENT) {
            initial = CARRIED[previous.final][1];
        } else if (previous && syllable.initial === RIEUL && (previous.final === FINAL_RIEUL || previous.final === FINAL_NIEUN)) {
            initial = 'l';
        }
        let final = FINALS[syllable.final];
        if (syllable.final && next && next.initial === SILENT) {
            final = CARRIED[syllable.final][0];
        } else if (next && next.initial === RIEUL && syllable.final === FINAL_NIEUN) {
            final = 'l';
        }
        out += initial + VOWELS[syllable.vowel] + final;
    }
    return out;
}
