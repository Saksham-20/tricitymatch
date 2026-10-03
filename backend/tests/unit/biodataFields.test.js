/**
 * The biodata PDF must print the columns the Profile model actually has.
 * It used to read aboutMe, familyDetails, timeOfBirth, company, nriStatus,
 * countryOfResidence and visaStatus, none of which exist, so About, family,
 * birth time, employer and the NRI block never appeared in the member's PDF.
 */
const PDFDocument = require('pdfkit');
const { generateBiodataPDF } = require('../../utils/biodata');

const render = (profile) => {
  const printed = [];
  const spy = jest.spyOn(PDFDocument.prototype, 'text').mockImplementation(function text(t) { printed.push(String(t)); return this; });
  const chunks = [];
  const res = { setHeader: jest.fn(), write: jest.fn((c) => chunks.push(c)), end: jest.fn(), on: jest.fn(), once: jest.fn(), emit: jest.fn() };
  try { generateBiodataPDF(res, { profile, template: 'classic', photoBuffer: null, profileCode: 'TCS-TEST0001' }); } finally { spy.mockRestore(); }
  return printed.join('\n');
};

const FULL = {
  firstName: 'Asha', lastName: 'Verma', dateOfBirth: '1996-04-12', height: 165, maritalStatus: 'never_married',
  motherTongue: 'punjabi', nationality: 'Indian', city: 'chandigarh', state: 'chandigarh',
  rashi: 'mesha', nakshatra: 'ashwini', manglikStatus: 'no', gotra: 'kashyap', birthTime: '06:15', placeOfBirth: 'chandigarh',
  religion: 'hindu', caste: 'khatri',
  education: 'Masters', institution: 'Panjab University', profession: 'Engineer', industry: 'Software', income: 1200000,
  familyType: 'nuclear', familyValues: 'moderate', familyStatus: 'middle_class',
  fatherOccupation: 'Bank manager', motherOccupation: 'Teacher', brothers: 1, sisters: 0, familyLocation: 'Mohali',
  diet: 'vegetarian', isNri: true, residenceCountry: 'canada', residenceStatus: 'permanent_resident',
  bio: 'Loves hiking and reading.',
};

describe('biodata PDF content', () => {
  const text = render(FULL);

  it.each([
    ['About text', 'Loves hiking and reading.'],
    ['Father occupation', 'Bank manager'],
    ['Mother occupation', 'Teacher'],
    ['Family location', 'Mohali'],
    ['Family status', 'Middle class'],
    ['Birth time', '06:15'],
    ['Institution', 'Panjab University'],
    ['Industry', 'Software'],
    ['Nationality', 'Indian'],
    ['NRI country', 'Canada'],
    ['NRI residency status', 'Permanent resident'],
  ])('prints %s', (_label, needle) => {
    expect(text.toLowerCase()).toContain(needle.toLowerCase());
  });

  it.each(['ABOUT', 'FAMILY DETAILS', 'NRI DETAILS', 'Time of Birth', 'Brothers', 'Sisters'])('has the "%s" heading or row', (needle) => {
    expect(text).toContain(needle);
  });

  it('prints "0" siblings: zero is an answer, not an absence', () => {
    const t = render({ ...FULL, brothers: 0, sisters: 0 });
    const rows = t.split('\n');
    expect(rows.filter((r) => r === '0').length).toBe(2);
  });

  it('omits the family and NRI sections when there is nothing to show', () => {
    const t = render({ firstName: 'A', lastName: 'B', dateOfBirth: '1996-04-12' });
    expect(t).not.toContain('FAMILY DETAILS');
    expect(t).not.toContain('NRI DETAILS');
    expect(t).not.toContain('ABOUT');
  });
});
