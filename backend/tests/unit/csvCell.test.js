const { csvCell, csvRow } = require('../../utils/csv');

describe('csvCell', () => {
  it.each(['=1+1', '+SUM(A1)', '-2+3', '@SUM(1)', '|calc', '\t=1', '\r=1'])('neutralises a formula lead-in: %j', (v) => {
    const out = csvCell(v);
    expect(out.replace(/^"/, '').startsWith("'")).toBe(true);
  });

  it('quotes values that would break structure, and doubles quotes', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(csvCell('x\r\ny')).toBe('"x\r\ny"');
  });

  it('combines both protections', () => {
    expect(csvCell('=HYPERLINK("http://evil","x")')).toBe(`"'=HYPERLINK(""http://evil"",""x"")"`);
  });

  it('leaves ordinary text, dates and numbers alone (including negatives)', () => {
    expect(csvCell('Chandigarh')).toBe('Chandigarh');
    expect(csvCell('2026-09-29')).toBe('2026-09-29');
    expect(csvCell(-120)).toBe('-120');
    expect(csvCell(0)).toBe('0');
  });

  it('renders null and undefined as empty', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('csvRow joins encoded cells', () => {
    expect(csvRow(['a', '=x', 3, null])).toBe("a,'=x,3,");
  });
});
