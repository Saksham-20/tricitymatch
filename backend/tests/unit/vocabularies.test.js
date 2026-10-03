const {
  normalizeEducation, normalizeProfession, professionGroupFromFilter, normalizeCaste, PROFESSION_GROUPS,
} = require('../../constants/vocabularies');

describe('education levels', () => {
  it.each([
    ['Masters', 'master'], ['Master', 'master'], ['M.Tech', 'master'], ['MBA', 'master'], ['M.Com', 'master'],
    ['M.A', 'master'], ['Post Graduate', 'master'], ['post-graduation (M.Sc)', 'master'],
    ['Bachelors', 'bachelor'], ['Bachelor', 'bachelor'], ['B.Tech', 'bachelor'], ['Graduate (B.Tech/B.E.)', 'bachelor'],
    ['B.Com', 'bachelor'], ['BBA', 'bachelor'],
    ['PhD', 'doctorate'], ['Ph.D', 'doctorate'], ['Doctorate', 'doctorate'],
    ['MBBS', 'professional'], ['BDS', 'professional'], ['CA', 'professional'], ['Professional Degree', 'professional'],
    ['Diploma', 'diploma'], ['Polytechnic diploma', 'diploma'],
    ['12th Pass', 'school'], ['High school', 'school'],
  ])('%s -> %s', (input, level) => {
    expect(normalizeEducation(input)).toBe(level);
  });

  // PROF-08: branch names and 2-letter abbreviations must not outrank the degree.
  it.each([
    ['B.Tech (ME)', 'bachelor'], ['Diploma in ME', 'diploma'], ['B.Tech CS', 'bachelor'],
    ['Bachelor of Science in CS', 'bachelor'], ['B.Pharma', 'bachelor'], ['M.Pharma', 'master'], ['D.Pharma', 'diploma'],
    ['ME', 'master'], ['M.S.', 'master'], ['CS', 'professional'], ['MD', 'professional'],
    ['MS Office certified', null],
  ])('ambiguous: %s -> %s', (input, level) => {
    expect(normalizeEducation(input)).toBe(level);
  });

  it('returns null for blank or unrecognised input rather than guessing', () => {
    expect(normalizeEducation('')).toBeNull();
    expect(normalizeEducation('   ')).toBeNull();
    expect(normalizeEducation(null)).toBeNull();
    expect(normalizeEducation('Self taught')).toBeNull();
  });
});

describe('profession groups', () => {
  it('a medical or sales representative is business, not a clinician', () => {
    expect(normalizeProfession('Medical Representative')).toBe('Business / Management');
    expect(normalizeProfession('Sales Executive')).toBe('Business / Management');
    expect(normalizeProfession('Medical Officer')).toBe('Doctor / Healthcare');
  });

  it.each([
    ['Software Engineer', 'Software / IT'], ['Engineer (Software)', 'Software / IT'], ['IT Professional', 'Software / IT'],
    ['Engineer', 'Engineer'], ['Engineer (Other)', 'Engineer'],
    ['Doctor', 'Doctor / Healthcare'], ['Doctor / Physician', 'Doctor / Healthcare'], ['Dentist', 'Doctor / Healthcare'], ['Nurse / Paramedic', 'Doctor / Healthcare'],
    ['Lawyer', 'Lawyer / Legal'],
    ['Teacher', 'Teacher / Academia'], ['Teacher / Professor', 'Teacher / Academia'], ['Scientist / Researcher', 'Teacher / Academia'],
    ['CA', 'CA / Finance'], ['CA / Accountant', 'CA / Finance'], ['Accountant', 'CA / Finance'], ['Banker / Finance', 'CA / Finance'],
    ['Architect', 'Architecture / Design / Media'], ['Artist / Designer', 'Architecture / Design / Media'],
    ['Business', 'Business / Management'], ['Business Owner', 'Business / Management'], ['Business Analyst', 'Business / Management'],
    ['Entrepreneur', 'Business / Management'], ['Consultant', 'Business / Management'],
    ['Government Employee', 'Government / Civil Services'], ['Civil Servant', 'Government / Civil Services'],
    ['Armed Forces', 'Armed Forces / Police'], ['Police / IPS', 'Armed Forces / Police'],
    ['Student', 'Student'],
    ['Astronaut', 'Other'],
  ])('%s -> %s', (input, group) => {
    expect(normalizeProfession(input)).toBe(group);
    expect(PROFESSION_GROUPS).toContain(group);
  });

  it('is null for blank, and accepts a group label as a filter value', () => {
    expect(normalizeProfession('')).toBeNull();
    expect(professionGroupFromFilter('software / it')).toBe('Software / IT');
    expect(professionGroupFromFilter('Doctor')).toBe('Doctor / Healthcare');
  });
});

describe('caste', () => {
  it('rewrites exact and alias spellings to the canonical one and keeps everything else as typed', () => {
    expect(normalizeCaste('jatt')).toBe('Jatt');
    expect(normalizeCaste('  Jat   Sikh ')).toBe('Jatt');
    expect(normalizeCaste('AGARWAL')).toBe('Aggarwal');
    expect(normalizeCaste('brahman')).toBe('Brahmin');
    expect(normalizeCaste('Some Rare Community')).toBe('Some Rare Community');
    expect(normalizeCaste('')).toBe('');
    expect(normalizeCaste(null)).toBeNull();
  });
});
