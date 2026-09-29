const { NAME_PATTERN, cleanName } = require('../../constants/names');
const { pdfSafe } = require('../../utils/pdfText');

describe('name rule (Unicode names)', () => {
  it.each([
    'Aman', "O'Neil", 'Jean-Luc', 'Mary Ann', 'Dr. Singh', 'José', 'Ångström',
    'अमन', 'प्रीति शर्मा', 'ਗੁਰਪ੍ਰੀਤ ਸਿੰਘ', 'ਹਰਪ੍ਰੀਤ', 'Aman ਸਿੰਘ',
  ])('accepts %s', (name) => {
    expect(NAME_PATTERN.test(name)).toBe(true);
  });

  it.each([
    'Aman1', 'a@b', '<script>', 'x;y', '', '१२३', '੧੨੩', 'a‮b', 'a\u0000b', '😀',
    'Аман', // Cyrillic look-alike of Latin letters
    'Αλέξ', // Greek
    'a×b',  // multiplication sign
    '名前',
  ])('rejects %j', (name) => {
    expect(NAME_PATTERN.test(name)).toBe(false);
  });

  it('keeps zero-width joiners used inside Indic words', () => {
    expect(NAME_PATTERN.test('क‍ष')).toBe(true);
  });

  it('cleanName strips what a name may not contain and clamps length', () => {
    expect(cleanName('  Aman<b>1 Singh ')).toBe('Amanb Singh');
    expect(cleanName('ਗੁਰਪ੍ਰੀਤ')).toBe('ਗੁਰਪ੍ਰੀਤ');
    expect(cleanName('x'.repeat(80)).length).toBe(50);
    expect(cleanName(null)).toBe('');
  });
});

describe('pdfSafe', () => {
  it('keeps the drawable part of a mixed name and drops what the font cannot draw', () => {
    expect(pdfSafe('Aman ਸਿੰਘ')).toBe('Aman');
  });
  it('falls back when nothing is drawable', () => {
    expect(pdfSafe('ਗੁਰਪ੍ਰੀਤ', 'Member')).toBe('Member');
    expect(pdfSafe('', 'Member')).toBe('Member');
  });
  it('leaves ordinary text, accents, dashes and the rupee sign alone', () => {
    expect(pdfSafe('José – ₹5,000 “ok”')).toBe('José – ₹5,000 “ok”');
  });
});
