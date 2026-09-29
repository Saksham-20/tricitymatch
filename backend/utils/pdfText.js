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
// rupee sign, which the existing invoice already draws.
const DRAWABLE = /[^\u0009\u000A\u000D -~ -ÿ–—‘’“”•…₹]/g;

const pdfSafe = (value, fallback = '') => {
  const cleaned = String(value ?? '').replace(DRAWABLE, '').replace(/\s{2,}/g, ' ').trim();
  return cleaned || fallback;
};

module.exports = { pdfSafe };
