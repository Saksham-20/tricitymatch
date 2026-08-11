/**
 * The one client-side password rule, mirroring the server validator.
 *
 * Three screens each carried their own approximation. All three accepted a
 * symbol the server rejects (`[^A-Za-z0-9]` vs the server's `@$!%*?&`), so
 * `Passw0rd#` looked valid, was submitted, and came back 400 — a member typing
 * a password the app told them was fine and the server refused. That is the
 * same divergence that was fixed once in 2026-06-29 by editing each screen
 * separately, which is why it came back.
 *
 * Mirrored from backend/routes/authRoutes.js and backend/validators/index.js:
 *
 *   .isLength({ min: 8 })
 *   .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
 *
 * Note the server pattern has no closing anchor — only the FIRST character is
 * constrained to the allowed set, so `Passw0rd!#` passes on the server. This
 * copy reproduces that rather than being stricter: a client stricter than the
 * server rejects passwords that would have worked, which is just as wrong as
 * being looser, and harder to notice. passwordRule.test.ts pins the two
 * together by reading the server's regex out of its source.
 */

export const MIN_PASSWORD_LENGTH = 8;

export const SERVER_PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;

/** null when acceptable, otherwise the reason to show the member. */
export const passwordProblem = (password: string): string | null => {
  if (!password) return 'Password is required';
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters`;
  if (!SERVER_PASSWORD_PATTERN.test(password)) {
    return 'Include an uppercase letter, a lowercase letter, a number and one of @ $ ! % * ? &';
  }
  return null;
};

export const isAcceptablePassword = (password: string): boolean => passwordProblem(password) === null;

/** iOS/Android password-manager generation hint, matching the rule above. */
export const PASSWORD_RULES_ATTR =
  'minlength: 8; required: lower; required: upper; required: digit; required: [@$!%*?&];';
