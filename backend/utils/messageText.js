'use strict';

/**
 * Normalise a chat message for storage.
 *
 * Messages are plain text and are stored as typed. They used to be HTML-escaped
 * on the way in (& to &amp;, ' to &#x27;, ...) and had anything shaped like a tag
 * deleted, but no client ever decoded them: React and React Native both render
 * text safely on their own, so members saw "&#x27;" for an apostrophe, edits
 * compounded it ("&amp;#x27;"), and a message such as "x <3 y> z" lost text.
 * Escaping belongs at the point text is written into HTML, and no server code
 * does that with message content (the new-message email carries only the sender's
 * name). The scam/link detector also reads the raw text now, so a URL containing
 * "&" is matched as typed.
 *
 * What is still removed: control characters (they can break rendering and
 * logs). Newlines and tabs survive. Surrounding whitespace is trimmed.
 */
const cleanMessageText = (content) => {
  if (typeof content !== 'string') return '';
  return content
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
};

module.exports = { cleanMessageText };
