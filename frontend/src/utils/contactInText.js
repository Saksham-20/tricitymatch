/**
 * Client copy of backend/utils/contactInText.js (detection only), so the
 * profile editor can stop a save and point at the field before the server
 * refuses it. Owner rule: a phone number belongs in the phone-number field and
 * nowhere else, and no other contact detail (email, link, messenger handle,
 * UPI ID) belongs in anything a member writes on a profile. Keep the two copies
 * in step; the server is the authority.
 */

import i18n from '../i18n';

const ZERO_WIDTH = new RegExp('[\\u200B-\\u200D\\u2060\\uFEFF]', 'g');

const NUMBER_WORDS = {
  zero: '0', oh: '0', one: '1', two: '2', three: '3', four: '4', five: '5',
  six: '6', seven: '7', eight: '8', nine: '9',
  // Hindi / Punjabi in Latin script
  shunya: '0', ek: '1', do: '2', teen: '3', char: '4', chaar: '4', paanch: '5', panch: '5',
  chhe: '6', che: '6', saat: '7', aath: '8', nau: '9',
};
// Only a run of several number words is read as digits: "one sister" is not a phone number.
const NUMBER_WORD_RUN = new RegExp(`\\b(?:(?:${Object.keys(NUMBER_WORDS).join('|')})[\\s,.-]*){5,}\\b`, 'gi');
const spellDigits = (t) => t.replace(NUMBER_WORD_RUN, (run) =>
  run.split(/[\s,.-]+/).filter(Boolean).map((w) => NUMBER_WORDS[w.toLowerCase()] ?? '').join(' '));

// Digit groups joined by at most two separator characters.
const DIGIT_RUN = /\+?\d(?:[\s().,\-/]{0,2}\d)*/g;

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/i;
// "name at gmail dot com" and friends.
const EMAIL_SPELLED = /\b(?:gmail|yahoo|hotmail|outlook|rediff(?:mail)?|icloud|proton(?:mail)?)\s*(?:dot|\.)\s*com\b|\bat\s+(?:gmail|yahoo|hotmail|outlook|rediff(?:mail)?)\b/i;
// name@bank with no dot after the @: a UPI ID, which an email address never is.
const UPI_ID = /(?<![\w.-])[a-z0-9._-]{2,}@(?:ok)?[a-z]{2,}(?![\w.@-])/i;
const MESSENGER = /(?<![\w@.-])(?:wa\.me|t\.me|ig\.me|telegram\.me)\b|\b(?:whats\s*app|whatsapp|telegram|insta(?:gram)?|snap(?:chat)?|fb|facebook)\s*(?:me|no\.?|number|id|handle|@|:)|\b(?:call|text|ping|dm|message|msg)\s+me\s+(?:on|at)\b/i;
// A link: an explicit scheme or www., or a known social / messaging host. Bare
// "x.com"-style domains are NOT matched in general, or "B.Com" would be a link.
const LINK = /\bhttps?:\/\/\S+|\bwww\.\S+|\b(?:instagram|facebook|fb|linkedin|twitter|youtube|youtu|snapchat|tiktok|telegram|whatsapp|threads|x)\.(?:com|me|be|in)\b(?:\/\S*)?/i;

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

const prepare = (text) => spellDigits(String(text).normalize('NFKC').replace(ZERO_WIDTH, ''));

/** The kind of contact detail found in `text`, or null. */
const findContactInText = (text) => {
  if (typeof text !== 'string' || !text.trim()) return null;
  const t = prepare(text);
  if ((t.match(DIGIT_RUN) || []).some(runHasMobile)) return 'phone';
  if (EMAIL.test(t) || EMAIL_SPELLED.test(t)) return 'email';
  if (MESSENGER.test(t)) return 'messenger';
  if (LINK.test(t)) return 'link';
  if (UPI_ID.test(t)) return 'upi';
  return null;
};

export const CONTACT_IN_TEXT_MESSAGES = {
  phone: 'Please take the phone number out. Your number goes only in the phone number field, and members see it only the way you choose in Settings.',
  email: 'Please take the email address out. Members reach you through TricityMatch.',
  messenger: 'Please take out WhatsApp, Telegram, Instagram or other handles. Members reach you through TricityMatch.',
  link: 'Please take the link out. Social profiles go in Social connections, where only your matches can see them.',
  upi: 'Please take the payment ID out. Never share payment details on your profile.',
};

/** The message for `kind` in the current language (English: CONTACT_IN_TEXT_MESSAGES). */
export const contactInTextMessage = (kind) =>
  (kind ? i18n.t(`editor.contact.${kind}`, { defaultValue: CONTACT_IN_TEXT_MESSAGES[kind] }) : '');

export { findContactInText, runHasMobile };
