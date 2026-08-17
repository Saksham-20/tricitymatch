// Curated profile prompts — warm, family-forward, matrimonial in voice
// (never dating-app flirty). Stored server-side as free text in
// Profiles.profilePrompts {prompt1, answer1, …} (migration 000008, already
// live; web renders them under "Get to Know Me").
export const PROFILE_PROMPTS: readonly string[] = [
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

export interface PromptPair {
  prompt: string;
  answer: string;
}

/** Flatten UI pairs → the stored {prompt1, answer1, …} shape (filled slots only). */
export function toProfilePrompts(pairs: PromptPair[]): Record<string, string> {
  const out: Record<string, string> = {};
  let slot = 1;
  for (const p of pairs) {
    if (p.prompt && p.answer.trim()) {
      out[`prompt${slot}`] = p.prompt;
      out[`answer${slot}`] = p.answer.trim();
      slot += 1;
    }
    if (slot > 3) break;
  }
  return out;
}

/** Parse the stored shape → UI pairs. */
export function fromProfilePrompts(stored?: Record<string, string> | null): PromptPair[] {
  if (!stored) return [];
  const pairs: PromptPair[] = [];
  for (let i = 1; i <= 3; i += 1) {
    const prompt = stored[`prompt${i}`];
    const answer = stored[`answer${i}`];
    if (prompt && answer) pairs.push({ prompt, answer });
  }
  return pairs;
}
