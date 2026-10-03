const { normalizeGotra, sameGotra, gotraSql } = require('../../utils/gotra');

describe('normalizeGotra / sameGotra', () => {
  it.each([
    ['Kashyap', 'kashyap'], ['  KASHYAP  ', 'kashyap'], ['Kashyap Gotra', 'kashyap'], ['kashyap gotra', 'kashyap'],
    ['Bharadwaj  ', 'bharadwaj'], ['Sri   Vatsa', 'sri vatsa'], ['gotra', ''], ['', ''], [null, ''], [undefined, ''], [5, ''],
  ])('normalises %j to %j', (input, expected) => {
    expect(normalizeGotra(input)).toBe(expected);
  });

  it('matches the same gotra however it was typed', () => {
    expect(sameGotra('Kashyap', 'kashyap gotra')).toBe(true);
    expect(sameGotra(' Sri Vatsa ', 'sri  vatsa')).toBe(true);
  });

  it('never matches when either side did not say, or they differ', () => {
    expect(sameGotra('', '')).toBe(false);
    expect(sameGotra(null, 'kashyap')).toBe(false);
    expect(sameGotra('kashyap', undefined)).toBe(false);
    expect(sameGotra('kashyap', 'vashishth')).toBe(false);
  });

  it('builds a SQL expression over the given column', () => {
    expect(gotraSql('"Profile"."gotra"')).toContain('"Profile"."gotra"');
    expect(gotraSql()).toContain('regexp_replace');
  });
});
