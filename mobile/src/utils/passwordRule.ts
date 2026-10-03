/**
 * The one client-side password rule, mirroring the server's shared policy
 * (backend/utils/passwordPolicy.js): 8-100 characters with an uppercase letter,
 * a lowercase letter, a digit and one character that is not a letter, digit or
 * whitespace. The old server rule accepted only `@$!%*?&` and wrongly refused
 * passwords such as `Hello#1234`; client and server now allow any symbol.
 * passwordRule.test.ts pins the two together by reading the server's pattern
 * out of its source.
 */

export const MIN_PASSWORD_LENGTH = 8;

export const MAX_PASSWORD_LENGTH = 100;

export const SERVER_PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d\s])/;

/** null when acceptable, otherwise the reason to show the member. */
export const passwordProblem = (password: string): string | null => {
  if (!password) return 'Password is required';
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters`;
  if (password.length > MAX_PASSWORD_LENGTH) return `Use at most ${MAX_PASSWORD_LENGTH} characters`;
  if (!SERVER_PASSWORD_PATTERN.test(password)) {
    return 'Include an uppercase letter, a lowercase letter, a number and a symbol';
  }
  return null;
};

export const isAcceptablePassword = (password: string): boolean => passwordProblem(password) === null;

/** iOS/Android password-manager generation hint, matching the rule above. */
export const PASSWORD_RULES_ATTR =
  'minlength: 8; required: lower; required: upper; required: digit; required: special;';
