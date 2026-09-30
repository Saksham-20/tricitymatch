'use strict';

/**
 * Text for the PDFs we generate (biodata, Kundli report, invoice).
 *
 * pdfkit's built-in fonts cover Latin-1 only, and it does no complex-script
 * shaping, so a Devanagari or Gurmukhi string is drawn as wrong glyphs or
 * nothing. Names may now be written in those scripts (constants/names), so every
 * string that reaches a PDF goes through here: characters the font cannot draw
 * are dropped rather than printed as garbage, and a value that has nothing
 * drawable left falls back to a plain label.
 *
 * Embedding a Noto Sans Devanagari/Gurmukhi font with a shaping engine would
 * render these names properly. That is a bundled-font and layout change of its
 * own; until then the PDF shows the Latin part of a name, or the fallback.
 */

// Latin-1 letters and punctuation, general punctuation used in prose, and the
// rupee sign, which the existing invoice already draws. Tab and line breaks are
// kept. Decided by code point rather than a character-class regex so the control
// characters and the no-break space are explicit and readable.
const drawable = (code) => (
  code === 0x09 || code === 0x0a || code === 0x0d
  || (code >= 0x20 && code <= 0x7e)
  || (code >= 0xa0 && code <= 0xff)
  || code === 0x2013 || code === 0x2014
  || code === 0x2018 || code === 0x2019 || code === 0x201c || code === 0x201d
  || code === 0x2022 || code === 0x2026 || code === 0x20b9
);

const pdfSafe = (value, fallback = '') => {
  const kept = Array.from(String(value ?? '')).filter((ch) => drawable(ch.codePointAt(0))).join('');
  return kept.replace(/\s{2,}/g, ' ').trim() || fallback;
};

module.exports = { pdfSafe };
