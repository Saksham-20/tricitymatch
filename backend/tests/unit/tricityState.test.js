/**
 * Profiles never ask for the state, and the stored column defaulted to
 * "Punjab" for everyone: Panchkula (Haryana) and Chandigarh (a union territory)
 * read "…, Punjab". The place shown is now worked out from the city.
 */
const PDFDocument = require('pdfkit');
const { stateForCity, placeLabel } = require('../../utils/tricityState');
const { generateBiodataPDF } = require('../../utils/biodata');

describe('stateForCity', () => {
  it.each([
    ['Panchkula', 'Haryana'],
    ['Pinjore', 'Haryana'],
    ['Kalka', 'Haryana'],
    ['Barwala', 'Haryana'],
    ['Raipur Rani', 'Haryana'],
    ['Ambala', 'Haryana'],
    ['Ambala Cantt', 'Haryana'],
    ['Mohali', 'Punjab'],
    ['SAS Nagar', 'Punjab'],
    ['S.A.S. Nagar', 'Punjab'],
    ['Zirakpur', 'Punjab'],
    ['Kharar', 'Punjab'],
    ['Kurali', 'Punjab'],
    ['Derabassi', 'Punjab'],
    ['Dera Bassi', 'Punjab'],
    ['Landran', 'Punjab'],
    ['Banur', 'Punjab'],
    ['Mullanpur', 'Punjab'],
    ['New Chandigarh', 'Punjab'],
    ['Rupnagar (Ropar)', 'Punjab'],
    ['Ludhiana', 'Punjab'],
    ['Chandigarh', 'Chandigarh'],
    ['Baddi', 'Himachal Pradesh'],
    ['Nalagarh', 'Himachal Pradesh'],
    ['Shimla', 'Himachal Pradesh'],
    ['Delhi', 'Delhi'],
  ])('%s is in %s', (city, state) => {
    expect(stateForCity(city)).toBe(state);
  });

  it('ignores case and stray spaces', () => {
    expect(stateForCity('  panchkula ')).toBe('Haryana');
    expect(stateForCity('ZIRAKPUR')).toBe('Punjab');
  });

  it('knows every city the app offers in its city list', () => {
    const offered = [
      'Chandigarh', 'Mohali', 'Panchkula', 'Zirakpur', 'Kharar', 'Derabassi', 'New Chandigarh', 'Kurali',
      'Banur', 'Lalru', 'Baltana', 'Rajpura', 'Patiala', 'Rupnagar (Ropar)', 'Morinda', 'Ambala',
      'Ambala Cantt', 'Pinjore', 'Kalka', 'Nalagarh', 'Baddi', 'Ludhiana',
    ];
    expect(offered.filter((c) => !stateForCity(c))).toEqual([]);
  });

  it.each([['Toronto'], ['Sector 70'], [''], [null], [undefined], [42]])('returns null for %p', (city) => {
    expect(stateForCity(city)).toBeNull();
  });
});

describe('placeLabel', () => {
  it('names the real state', () => {
    expect(placeLabel('Panchkula')).toBe('Panchkula, Haryana');
    expect(placeLabel('Zirakpur')).toBe('Zirakpur, Punjab');
    expect(placeLabel('Mohali')).toBe('Mohali, Punjab');
  });

  it('never says "Chandigarh, Chandigarh"', () => {
    expect(placeLabel('Chandigarh')).toBe('Chandigarh');
    expect(placeLabel('chandigarh')).toBe('chandigarh');
    expect(placeLabel('Delhi')).toBe('Delhi');
  });

  it('shows an unknown or overseas city on its own', () => {
    expect(placeLabel('Toronto')).toBe('Toronto');
    expect(placeLabel('  Brampton ')).toBe('Brampton');
  });

  it('is null without a city', () => {
    expect(placeLabel('')).toBeNull();
    expect(placeLabel('   ')).toBeNull();
    expect(placeLabel(null)).toBeNull();
  });
});

describe('biodata PDF location line', () => {
  const render = (profile, template) => {
    const printed = [];
    const spy = jest.spyOn(PDFDocument.prototype, 'text').mockImplementation(function text(t) { printed.push(String(t)); return this; });
    const res = { setHeader: jest.fn(), write: jest.fn(), end: jest.fn(), on: jest.fn(), once: jest.fn(), emit: jest.fn() };
    try { generateBiodataPDF(res, { profile, template, photoBuffer: null, profileCode: 'TCS-TEST0001' }); } finally { spy.mockRestore(); }
    return printed.join('\n');
  };
  const base = { firstName: 'Asha', lastName: 'Verma', dateOfBirth: '1996-04-12' };

  it.each(['classic', 'modern'])('%s: a Panchkula profile stored as Punjab prints Haryana', (template) => {
    const text = render({ ...base, city: 'panchkula', state: 'Punjab' }, template);
    expect(text).toContain('Panchkula, Haryana');
    expect(text).not.toContain('Panchkula, Punjab');
  });

  it.each(['classic', 'modern'])('%s: Chandigarh prints once, without a state', (template) => {
    const text = render({ ...base, city: 'chandigarh', state: 'Punjab' }, template);
    expect(text).toContain('Chandigarh');
    expect(text).not.toMatch(/Chandigarh, (Punjab|Chandigarh)/);
  });

  it('an overseas city prints alone, not with the stored state', () => {
    const text = render({ ...base, city: 'toronto', state: 'Punjab' }, 'classic');
    expect(text).toContain('Toronto');
    expect(text).not.toContain('Toronto, Punjab');
  });
});
