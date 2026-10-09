import i18n from '../i18n';

// Curated profile prompts. Same list as the app (mobile/src/constants/prompts.ts)
// so a prompt answered on either one reads the same everywhere. Stored as
// Profiles.profilePrompts { prompt1, answer1, … }, at most three filled slots.
// The stored value is the English question text; only what is shown is
// translated (`promptLabel`), matched by its position in this list.
export const PROFILE_PROMPTS = [
  'What my family means to me',
  'My idea of a perfect Sunday',
  'What I value most in a partner',
  'A tradition I want to carry forward',
  'The best advice my parents gave me',
  'What makes me feel at home',
  'Something I am working towards',
  'How my friends would describe me',
  'A small thing that makes me happy',
  'What marriage means to me',
];

/** The question as shown in the current language; unknown text is shown as is. */
export const promptLabel = (prompt, t = i18n.t.bind(i18n)) => {
  const i = PROFILE_PROMPTS.indexOf(prompt);
  return i >= 0 ? t(`prompts.questions.q${i + 1}`) : prompt;
};

export const MAX_PROMPTS = 3;
export const PROMPT_ANSWER_MAX = 300;

/** Stored shape → editable pairs (filled slots only). */
export function fromProfilePrompts(stored) {
  if (!stored || typeof stored !== 'object') return [];
  const pairs = [];
  for (let i = 1; i <= MAX_PROMPTS; i += 1) {
    const prompt = stored[`prompt${i}`];
    const answer = stored[`answer${i}`];
    if (prompt) pairs.push({ prompt, answer: answer || '' });
  }
  return pairs;
}

/** Editable pairs → stored shape. Empty answers are dropped, slots renumbered. */
export function toProfilePrompts(pairs) {
  const out = {};
  let slot = 1;
  for (const p of pairs) {
    if (slot > MAX_PROMPTS) break;
    if (p.prompt && p.answer && p.answer.trim()) {
      out[`prompt${slot}`] = p.prompt;
      out[`answer${slot}`] = p.answer.trim();
      slot += 1;
    }
  }
  return out;
}
