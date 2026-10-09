import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveCsv, describeExport } from '../../utils/saveCsv';

describe('saving a streamed CSV', () => {
  let clicked;
  beforeEach(() => {
    clicked = [];
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:x');
    globalThis.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click() { clicked.push(this.download); });
  });

  const res = (text, headers = {}) => ({ data: new Blob([text], { type: 'text/csv' }), headers });

  it('reads the row count the server announced and the file name it chose', async () => {
    const out = await saveCsv(res('a,b\n1,2\n', { 'x-total-rows': '1204', 'content-disposition': 'attachment; filename="tricitymatch-members-2026-10-05.csv"' }), 'fallback.csv');
    expect(out).toEqual({ expected: 1204, incomplete: false });
    expect(clicked).toEqual(['tricitymatch-members-2026-10-05.csv']);
  });

  it('uses the fallback name and no count when the headers are absent', async () => {
    const out = await saveCsv(res('a\n'), 'fallback.csv');
    expect(out).toEqual({ expected: null, incomplete: false });
    expect(clicked).toEqual(['fallback.csv']);
  });

  it('notices a stream that broke part-way', async () => {
    const out = await saveCsv(res('a,b\n1,2\n# EXPORT INTERRUPTED after 1 rows: this file is incomplete. Try again.\n', { 'x-total-rows': '9' }), 'f.csv');
    expect(out.incomplete).toBe(true);
  });

  it('words the result for the toast', () => {
    expect(describeExport('members', { expected: 1204, incomplete: false })).toEqual({ ok: true, text: 'Downloaded 1,204 members.' });
    expect(describeExport('members', { expected: 1, incomplete: false }).text).toBe('Downloaded 1 member.');
    expect(describeExport('members', { expected: null, incomplete: false }).text).toBe('Members export downloaded.');
    expect(describeExport('people', { expected: 1, incomplete: false }).text).toBe('Downloaded 1 person.');
    expect(describeExport('members', { expected: 9, incomplete: true }).ok).toBe(false);
  });
});
