'use strict';

/**
 * What a person's name may contain (audit P2: Unicode names at signup).
 *
 * The old rule was `[a-zA-Z\s'-]`, which refused every Hindi and Punjabi name
 * written in its own script for a product aimed at Chandigarh, Mohali and
 * Panchkula. Names may now be written in Latin (with accents), Devanagari or
 * Gurmukhi, plus spaces, apostrophes, full stops and hyphens.
 *
 * Deliberately NOT "any Unicode letter": a name is shown to other members, and
 * allowing every script would allow Cyrillic or Greek look-alikes of Latin
 * letters (an "а" that is not an "a") to impersonate another member. Three
 * scripts the audience actually uses keeps that surface closed.
 *
 * Explicit ranges rather than `\p{Script=...}`: the same expression is shared
 * with the React Native client, and Hermes' support for property escapes is
 * partial.
 *
 *   Latin        A-Z a-z and Latin-1 accented letters (no multiplication or
 *                division signs)
 *   Devanagari   U+0900-0963 and U+0971-097F (letters, vowel signs, virama;
 *                excludes the danda punctuation and Devanagari digits)
 *   Gurmukhi     U+0A01-0A65 and U+0A70-0A75 (excludes Gurmukhi digits)
 *   U+200C/D     zero-width (non-)joiner, which Indic scripts use inside words
 *
 * Bidirectional and other invisible control characters are not in the set.
 */

const NAME_CHARS = "A-Za-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u00FF\\u0900-\\u0963\\u0971-\\u097F\\u0A01-\\u0A65\\u0A70-\\u0A75\\u200C\\u200D\\s'\\u2019.-";

const NAME_PATTERN = new RegExp(`^[${NAME_CHARS}]+$`);
const NAME_STRIP_PATTERN = new RegExp(`[^${NAME_CHARS}]`, 'g');

/** Remove everything a name may not contain, trim, and clamp the length. */
const cleanName = (value, max = 50) => String(value ?? '').replace(NAME_STRIP_PATTERN, '').trim().slice(0, max);

module.exports = { NAME_CHARS, NAME_PATTERN, NAME_STRIP_PATTERN, cleanName };
