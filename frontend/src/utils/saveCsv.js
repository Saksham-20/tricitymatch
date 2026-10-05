/**
 * Save a streamed CSV response (axios `responseType: 'blob'`) and report on it.
 *
 * The server streams exports with no row cap and states the row count up front
 * in `X-Total-Rows`. If the stream broke part-way the status line had already
 * gone out as 200, so the server ends the file with a `# EXPORT INTERRUPTED`
 * marker row instead. Reading both lets the page say "Downloaded 1,204 members"
 * or warn that the file is incomplete, rather than saving a short file silently.
 */

const MARKER = '# EXPORT INTERRUPTED';

export async function saveCsv(res, fallbackName) {
  const blob = res.data instanceof Blob ? res.data : new Blob([res.data], { type: 'text/csv;charset=utf-8' });

  const disposition = res.headers?.['content-disposition'] || '';
  const named = /filename="?([^";]+)"?/i.exec(disposition)?.[1];
  const header = res.headers?.['x-total-rows'];
  const expected = header !== undefined && header !== '' && Number.isFinite(Number(header)) ? Number(header) : null;

  // The marker is the last line, so only the tail needs reading.
  let incomplete = false;
  try {
    const tail = await blob.slice(Math.max(0, blob.size - 400)).text();
    incomplete = tail.includes(MARKER);
  } catch { /* an unreadable tail is treated as complete; the row count above still shows */ }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = named || fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  return { expected, incomplete };
}

export const describeExport = (noun, { expected, incomplete }) => {
  if (incomplete) return { ok: false, text: `The ${noun} file stopped part-way and is incomplete. Run the export again.` };
  if (expected === null) return { ok: true, text: `${noun} export downloaded.` };
  return { ok: true, text: `Downloaded ${expected.toLocaleString('en-IN')} ${expected === 1 ? noun.replace(/s$/, '') : noun}.` };
};
