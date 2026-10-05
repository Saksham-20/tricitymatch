/**
 * Copy text to the clipboard and say whether it worked.
 *
 * `navigator.clipboard` is missing on non-HTTPS origins and refused in some
 * in-app browsers, and the bare call used to throw an unhandled rejection with
 * no feedback. Falls back to a selected, off-screen textarea and
 * `document.execCommand('copy')`, which older Safari and WebViews still honour.
 *
 * @returns {Promise<boolean>} true when the text reached the clipboard
 */
export default async function copyText(text) {
  const value = String(text ?? '');
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch { /* fall through to the legacy path */ }

  try {
    const el = document.createElement('textarea');
    el.value = value;
    el.setAttribute('readonly', '');
    el.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0;';
    document.body.appendChild(el);
    el.select();
    el.setSelectionRange(0, value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}
