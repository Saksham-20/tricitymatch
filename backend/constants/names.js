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

// One alternative per script, each class holding a single range, with the
// zero-width joiners as alternatives of their own. Merged into one class the
// linter reads a range end followed by a combining mark (U+0963 then U+0971) or
// a joiner as a base-plus-mark sequence; as separate alternatives they are
// simply allowed characters. Kept as a literal (not assembled from strings) so
// the same text can be read, and checked, exactly as it will run.
const NAME_PATTERN = /^(?:[A-Za-zÀ-ÖØ-öø-ÿ]|[ऀ-ॣ]|[ॱ-ॿ]|[ਁ-੥]|[ੰ-ੵ]|[\s'’.-]|‌|‍)+$/;

// Every code point that is NOT an allowed name character. Built from the same
// pattern text so the two can never drift apart.
const ALLOWED_ONE = NAME_PATTERN.source.replace(/^\^/, '').replace(/\+\$$/, '');
const NAME_STRIP_PATTERN = new RegExp(`(?!${ALLOWED_ONE}).`, 'gsu');

/** Remove everything a name may not contain, trim, and clamp the length. */
const cleanName = (value, max = 50) => String(value ?? '').replace(NAME_STRIP_PATTERN, '').trim().slice(0, max);

module.exports = { NAME_PATTERN, NAME_STRIP_PATTERN, cleanName };
