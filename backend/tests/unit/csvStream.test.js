const { PassThrough } = require('stream');
const { streamCsv } = require('../../utils/csvStream');

const fakeRes = () => {
  const res = new PassThrough();
  res.headers = {};
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.text = '';
  res.setEncoding('utf8');
  res.on('data', (d) => { res.text += d; });
  return res;
};
const done = (res) => new Promise((r) => res.on('end', r));

describe('streamCsv', () => {
  it('writes a BOM + header, every batch in order, and ends cleanly', async () => {
    const res = fakeRes();
    const pages = { null: { rows: [1, 2], next: 'a' }, a: { rows: [3, 4], next: 'b' }, b: { rows: [5], next: null } };
    const finished = done(res);
    const out = await streamCsv(res, {
      filename: 'x.csv', header: ['n', 'sq'], total: 5,
      fetchBatch: async (c) => pages[String(c)],
      toRow: (n) => [n, n * n],
    });
    await finished;
    expect(out).toEqual({ rows: 5, aborted: false });
    expect(res.text).toBe('﻿n,sq\n1,1\n2,4\n3,9\n4,16\n5,25\n');
    expect(res.headers['X-Total-Rows']).toBe('5');
    expect(res.headers['Content-Disposition']).toBe('attachment; filename="x.csv"');
  });

  it('guards formula cells and quotes commas, like every other export', async () => {
    const res = fakeRes();
    const finished = done(res);
    await streamCsv(res, { filename: 'x.csv', header: ['a'], fetchBatch: async () => ({ rows: ['=1+1', 'a,b'], next: null }), toRow: (v) => [v] });
    await finished;
    expect(res.text).toBe("﻿a\n'=1+1\n\"a,b\"\n");
  });

  it('marks the file as interrupted instead of leaving a short file that looks complete', async () => {
    const res = fakeRes();
    const finished = done(res);
    let calls = 0;
    const log = { error: jest.fn() };
    const out = await streamCsv(res, {
      filename: 'x.csv', header: ['n'], log,
      fetchBatch: async () => { calls += 1; if (calls === 2) throw new Error('db gone'); return { rows: [1], next: 'more' }; },
      toRow: (n) => [n],
    });
    await finished;
    expect(out).toMatchObject({ rows: 1, aborted: true });
    expect(res.text).toMatch(/# EXPORT INTERRUPTED after 1 rows/);
    expect(log.error).toHaveBeenCalled();
  });

  it('stops querying when the client has gone away', async () => {
    const res = fakeRes();
    let calls = 0;
    const out = await streamCsv(res, {
      filename: 'x.csv', header: ['n'],
      fetchBatch: async () => { calls += 1; if (calls === 1) res.destroy(); return { rows: [1], next: 'more' }; },
      toRow: (n) => [n],
    });
    expect(out.aborted).toBe(true);
    expect(calls).toBe(1);
  });
});
