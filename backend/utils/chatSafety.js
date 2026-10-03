'use strict';

/**
 * Scam and phishing signals in chat messages (audit P2).
 *
 * Matrimonial chat is where romance-and-money fraud happens: a "match" who
 * moves quickly to a payment app, a bank detail, an "urgent" transfer, or a
 * link to a fake KYC page. This module reads a message and reports which of
 * those signals it carries.
 *
 * It never blocks and never decides. Matches are stored on the message
 * (`safetyFlags`) so the recipient's app can put a warning beside it, and a
 * sender who keeps tripping the strongest signals across different members is
 * put in front of staff. Blocking on pattern alone would refuse honest messages
 * (a family sharing a biodata link; a groom's mother mentioning a dowry-free
 * "registration fee" for a hall) and teach fraudsters to phrase around the list;
 * a warning costs an honest sender nothing.
 *
 * Deliberately NOT flagged: phone numbers and email addresses. Mutual matches
 * exchange those in the ordinary course of a match, and they are the product.
 */

const { get: cacheGet, set: cacheSet, incr: cacheIncr } = require('./cache');

const SEVERITY = {
  upi_id: 'high',
  bank_details: 'high',
  payment_request: 'high',
  suspicious_link: 'high',
  off_platform: 'medium',
  external_link: 'low',
};
const RANK = { high: 0, medium: 1, low: 2 };

// Zero-width characters are a standard way to split a keyword so a filter misses
// it; fold them away and normalise compatibility forms before matching.
// Zero-width space/joiners, word joiner and byte-order mark, by code point.
const ZERO_WIDTH = new Set([0x200b, 0x200c, 0x200d, 0x2060, 0xfeff]);

const normalise = (text) => String(text || '')
  .normalize('NFKC')
  .split('').filter((ch) => !ZERO_WIDTH.has(ch.charCodeAt(0))).join('')
  .toLowerCase();

// name@handle where the handle has no dot (UPI), which an email address never
// has: `asha@gmail.com` does not match, `asha@okhdfcbank` does.
const UPI_ID = /(?<![\w.-])[a-z0-9._-]{2,64}@[a-z][a-z0-9]{1,20}\b(?!\.[a-z])/;

const BANK_DETAILS = [
  /\b[a-z]{4}0[a-z0-9]{6}\b/,                                                   // IFSC
  /\b(?:a\/c|acct?|account)\s*(?:no\.?|number|num|#)?\s*[:-]?\s*\d{9,18}\b/,  // account number
  // payment app + number, with the separators people actually type ("98765 43210", "98765-43210")
  /\b(?:upi|paytm|gpay|phonepe|google\s?pay|bhim)\b[^.\n]{0,25}(?<!\d)[6-9](?:[\s.-]?\d){9}(?!\d)/,
];

// An amount of money written as rupees/Rs/INR/₹ (in either order with a number).
const AMOUNT = String.raw`(?:(?:₹|\brs\.?|\binr\b)\s*\d[\d,.]*|\d[\d,.]*\s*(?:₹|rs\b\.?|inr\b|rupees?\b|rupay[ae]\b|rupaye\b|k\b))`;
const ASK = String.raw`(?:send|transfer|bhej\w*|pay\s+(?:me|on|via|to|by)|de\s+do|dedo)`;

const PAYMENT_PHRASES = [
  /\b(?:send|transfer)\s+(?:me\s+)?(?:some\s+)?(?:money|cash|funds|payment|paisa|paise|rupees?|rupaye|rupay[ae])\b/,
  // "send me 20000 rupees", "pay me ₹5000", "mujhe 5000 rupaye bhej do": an amount near a transfer verb
  new RegExp(`\\b${ASK}\\b[^.\\n]{0,14}${AMOUNT}`),
  new RegExp(`${AMOUNT}[^.\\n]{0,14}\\b${ASK}\\b`),
  /\btransfer\s+(?:the\s+|some\s+)?(?:money|amount|funds|payment)\b/,
  /\b(?:pay|paying)\s+(?:me\s+)?(?:an?\s+)?advance\b/,
  /\badvance\s+(?:payment|amount|fee)\b/,
  // A registration or booking fee is ordinary for a hall or a function; it is
  // only a signal when the sender is asking the other person to pay it.
  /\b(?:pay|send|deposit|transfer)\s+(?:me\s+)?(?:the\s+|a\s+|an\s+|some\s+)?(?:small\s+)?(?:registration|booking)\s+(?:fees?|charges?|amount)\b/,
  /\b(?:processing|verification|customs|clearance|visa|shipping|release|courier)\s+(?:fees?|charges?|amount)\b/,
  /\bgift\s?cards?\b/,
  /\b(?:western\s+union|moneygram)\b/,
  /\b(?:bitcoin|btc|usdt|ethereum|crypto(?:currency)?)\b/,
  /\b(?:forex|trading|investment)\s+(?:opportunity|platform|scheme|plan|group|app)\b/,
  // "urgent ... money" and "money ... emergency" within a short span
  /\b(?:need|require|want)\b[^.\n]{0,30}\b(?:money|cash|funds)\b[^.\n]{0,40}\b(?:urgent(?:ly)?|emergency|hospital|stuck|airport|customs|immediately|today)\b/,
  /\b(?:urgent(?:ly)?|emergency|hospital|stuck|airport|customs)\b[^.\n]{0,40}\b(?:need|require|send)\b[^.\n]{0,30}\b(?:money|cash|funds)\b/,
  // Hinglish
  /\bpaise\s+(?:bhej|send|transfer|de)\w*/,
  /\bmoney\s+(?:bhej|transfer)\w*/,
];

const SHORTENERS = new Set([
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'cutt.ly', 'rb.gy', 'is.gd', 'ow.ly', 'buff.ly', 'shorturl.at',
  'tiny.cc', 'rebrand.ly', 'lnkd.in', 'bl.ink', 'v.gd', 'trib.al', 'soo.gd', 's.id', 'clck.ru', 'urlz.fr',
]);
const RISKY_TLDS = new Set(['xyz', 'top', 'club', 'tk', 'ml', 'ga', 'cf', 'gq', 'cc', 'live', 'site', 'online', 'click', 'link', 'work', 'buzz', 'icu', 'monster', 'rest', 'fit']);
const PHISH_WORDS = /(?:login|log-in|signin|sign-in|verify|verification|secure|account|update|kyc|wallet|bank|refund|reward|prize|claim|otp)/;

// Chat apps people are steered onto to leave the platform's reach.
const OFF_PLATFORM = /(?<![\w@.-])(?:wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|t\.me|telegram\.(?:me|dog)|signal\.me|ig\.me)\b|\btelegram\s*(?:id|handle|username|@)|\b(?:message|msg|text|contact|add)\s+me\s+on\s+telegram\b|\bmove\s+(?:to|on)\s+(?:telegram|signal)\b/;

// "m o n e y": single letters spaced apart are a standard way past a keyword filter.
const collapseSpelledOut = (t) => t.replace(/\b(?:[a-z0-9][ .\-_]){3,}[a-z0-9]\b/g, (run) => run.replace(/[ .\-_]/g, ''));

const URL_LIKE = /(?<![\w@.-])(?:https?:\/\/|www\.)[^\s<>"']+|(?<![\w@.-])[a-z0-9][a-z0-9-]{0,62}(?:\.[a-z0-9-]{1,63})*\.(?:com|in|net|org|co|io|me|xyz|top|club|online|site|link|live|app|ly|gl|cc|tk|ml|ga|cf|gq|click|work|buzz|icu|info|biz|us|uk|ru|cn)(?:\/[^\s<>"']*)?/g;

const hostOf = (raw) => {
  const stripped = raw.replace(/^https?:\/\//, '').replace(/^www\./, '');
  return stripped.split(/[/?#]/)[0].replace(/:\d+$/, '');
};

const classifyUrl = (raw) => {
  const host = hostOf(raw);
  const path = raw.slice(raw.indexOf(host) + host.length);
  if (SHORTENERS.has(host)) return 'suspicious_link';
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return 'suspicious_link';   // raw IP address
  if (host.includes('xn--')) return 'suspicious_link';                     // punycode look-alike
  const tld = host.split('.').pop();
  if (RISKY_TLDS.has(tld)) return 'suspicious_link';
  if (PHISH_WORDS.test(host) || (PHISH_WORDS.test(path) && /(?:bank|kyc|wallet|otp|refund|reward|prize)/.test(path))) return 'suspicious_link';
  if ((host.match(/-/g) || []).length >= 3) return 'suspicious_link';       // brand-and-verb hyphen stuffing
  return 'external_link';
};

/**
 * @returns {{ flags: string[], high: boolean }} flags are unique codes, strongest first.
 */
const assessMessage = (text) => {
  const normal = normalise(text);
  if (!normal.trim()) return { flags: [], high: false };
  // Match against the text as typed AND with spelled-out words closed up.
  const squashed = collapseSpelledOut(normal);
  const t = normal;
  const found = new Set();

  const both = (re) => re.test(t) || (squashed !== t && re.test(squashed));
  if (UPI_ID.test(t)) found.add('upi_id');
  if (BANK_DETAILS.some(both)) found.add('bank_details');
  if (PAYMENT_PHRASES.some(both)) found.add('payment_request');
  if (OFF_PLATFORM.test(t)) found.add('off_platform');

  const urls = t.match(URL_LIKE) || [];
  for (const raw of urls) {
    const kind = classifyUrl(raw.replace(/[).,;:!?]+$/, ''));
    // wa.me / t.me are already reported as off_platform, which says more.
    if (kind === 'external_link' && OFF_PLATFORM.test(raw)) continue;
    found.add(kind);
  }

  const flags = [...found].sort((a, b) => RANK[SEVERITY[a]] - RANK[SEVERITY[b]]);
  return { flags, high: flags.some((f) => SEVERITY[f] === 'high') };
};

// ── Sender pattern escalation ─────────────────────────────────────────────────

const HIGH_WINDOW_SECONDS = 24 * 3600;
const ESCALATE_AT = 3;          // strong signals in the window...
const ESCALATE_DISTINCT = 2;    // ...sent to at least this many different members
const ESCALATE_ALWAYS_AT = 6;   // or this many regardless of recipients

/**
 * Count a strongly flagged message from `senderId`. When the pattern crosses the
 * line, returns true ONCE per window so the caller can alert staff exactly once.
 * Best-effort: any failure reads as "no escalation".
 */
const recordHighSignal = async (senderId, receiverId) => {
  try {
    const count = await cacheIncr(`chatsafety:high:${senderId}`, HIGH_WINDOW_SECONDS);
    const key = `chatsafety:recv:${senderId}`;
    const seen = (await cacheGet(key)) || [];
    if (!seen.includes(receiverId)) seen.push(receiverId);
    await cacheSet(key, seen.slice(-20), HIGH_WINDOW_SECONDS);

    const crossed = (count >= ESCALATE_AT && seen.length >= ESCALATE_DISTINCT) || count >= ESCALATE_ALWAYS_AT;
    if (!crossed) return false;
    return (await cacheIncr(`chatsafety:escalated:${senderId}`, HIGH_WINDOW_SECONDS)) === 1;
  } catch (error) {
    return false;
  }
};

module.exports = { assessMessage, recordHighSignal, SEVERITY, ESCALATE_AT, ESCALATE_ALWAYS_AT };
