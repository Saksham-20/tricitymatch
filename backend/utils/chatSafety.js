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
  external_link: 'low',
};

// Zero-width characters are a standard way to split a keyword so a filter misses
// it; fold them away and normalise compatibility forms before matching.
const normalise = (text) => String(text || '')
  .normalize('NFKC')
  .replace(/[​-‍⁠﻿]/g, '')
  .toLowerCase();

// name@handle where the handle has no dot (UPI), which an email address never
// has: `asha@gmail.com` does not match, `asha@okhdfcbank` does.
const UPI_ID = /(?<![\w.-])[a-z0-9._-]{2,64}@[a-z][a-z0-9]{1,20}\b(?!\.[a-z])/;

const BANK_DETAILS = [
  /\b[a-z]{4}0[a-z0-9]{6}\b/,                                                   // IFSC
  /\b(?:a\/c|acct?|account)\s*(?:no\.?|number|num|#)?\s*[:\-]?\s*\d{9,18}\b/,  // account number
  /\b(?:upi|paytm|gpay|phonepe|google\s?pay|bhim)\b[^.\n]{0,25}\b[6-9]\d{9}\b/, // payment app + number
];

const PAYMENT_PHRASES = [
  /\bsend\s+(?:me\s+)?(?:some\s+)?(?:money|cash|funds|payment)\b/,
  /\btransfer\s+(?:the\s+|some\s+)?(?:money|amount|funds|payment)\b/,
  /\b(?:pay|paying)\s+(?:me\s+)?(?:an?\s+)?advance\b/,
  /\badvance\s+(?:payment|amount|fee)\b/,
  /\b(?:processing|registration|verification|customs|clearance|visa|shipping|booking|release|courier)\s+(?:fees?|charges?|amount)\b/,
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
  const t = normalise(text);
  if (!t.trim()) return { flags: [], high: false };
  const found = new Set();

  if (UPI_ID.test(t)) found.add('upi_id');
  if (BANK_DETAILS.some((re) => re.test(t))) found.add('bank_details');
  if (PAYMENT_PHRASES.some((re) => re.test(t))) found.add('payment_request');

  const urls = t.match(URL_LIKE) || [];
  for (const raw of urls) found.add(classifyUrl(raw.replace(/[).,;:!?]+$/, '')));

  const flags = [...found].sort((a, b) => (SEVERITY[a] === 'high' ? 0 : 1) - (SEVERITY[b] === 'high' ? 0 : 1));
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
