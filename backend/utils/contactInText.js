'use strict';

/**
 * Contact details hidden in profile text.
 *
 * A bio is read by every member who opens the profile, so a phone number in it
 * skips the paid contact unlock and the owner's own "who can see my number"
 * setting, and it is the first move of the scams the safety page warns about.
 * People do not type numbers plainly when they know there is a filter: they
 * split them ("97410, 79680"), space them out, or prefix +91. This looks at
 * digit groups the way a reader would put them back together.
 *
 * Returns the kind of contact detail found, or null. Deliberately narrow:
 * dates, heights, salaries ("8,00,000 - 9,00,000") and years do not trip it.
 */

const ZERO_WIDTH = new RegExp('[\\u200B-\\u200D\\u2060\\uFEFF]', 'g');

// Digit groups joined by at most two separator characters.
const DIGIT_RUN = /\+?\d(?:[\s().,\-/]{0,2}\d)*/g;

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/i;
// "name at gmail dot com" and friends.
const EMAIL_SPELLED = /\b(?:gmail|yahoo|hotmail|outlook|rediff(?:mail)?|icloud|proton(?:mail)?)\s*(?:dot|\.)\s*com\b|\bat\s+(?:gmail|yahoo|hotmail|outlook|rediff(?:mail)?)\b/i;
const MESSENGER = /(?<![\w@.-])(?:wa\.me|t\.me|ig\.me|telegram\.me)\b|\b(?:whats\s*app|whatsapp|telegram|insta(?:gram)?|snap(?:chat)?)\s*(?:me|no\.?|number|id|handle|@|:)|\b(?:call|text|ping|dm)\s+me\s+(?:on|at)\b/i;

/**
 * True when some contiguous run of the groups in `run` makes a 10-digit Indian
 * mobile number (optionally after a 91 / 0 prefix group).
 */
const runHasMobile = (run) => {
  const groups = run.split(/\D+/).filter(Boolean);
  for (let i = 0; i < groups.length; i += 1) {
    let digits = '';
    for (let j = i; j < groups.length; j += 1) {
      digits += groups[j];
      if (digits.length > 13) break;
      let local = digits;
      if (local.length === 12 && local.startsWith('91')) local = local.slice(2);
      else if (local.length === 11 && local.startsWith('0')) local = local.slice(1);
      if (local.length === 10 && /^[6-9]/.test(local)) return true;
    }
  }
  return false;
};

const findContactInText = (text) => {
  if (typeof text !== 'string' || !text.trim()) return null;
  const t = text.normalize('NFKC').replace(ZERO_WIDTH, '');
  const runs = t.match(DIGIT_RUN) || [];
  if (runs.some(runHasMobile)) return 'phone';
  if (EMAIL.test(t) || EMAIL_SPELLED.test(t)) return 'email';
  if (MESSENGER.test(t)) return 'messenger';
  return null;
};

const MESSAGES = {
  phone: 'Please take the phone number out. Members reach you through TricityMatch, and your number is shared only the way you choose in Settings.',
  email: 'Please take the email address out. Members reach you through TricityMatch.',
  messenger: 'Please take out WhatsApp, Telegram or social handles. Members reach you through TricityMatch.',
};

module.exports = { findContactInText, runHasMobile, CONTACT_IN_TEXT_MESSAGES: MESSAGES };
