const {
  getAshtakootScore, getKundliMatch, buildKundliSummary, resolveRashi, getRashiCompatibility,
} = require('../../utils/compatibility');

const STARS = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha',
  'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha',
  'Jyeshtha', 'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
  'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
];

const gunas = (groom, bride) => {
  const r = getAshtakootScore(groom, bride);
  return Object.fromEntries(Object.entries(r.gunas).map(([k, v]) => [k, v.score]));
};

describe('Ashtakoot guna milan', () => {
  test('same star and same sign: everything full except Nadi (same nadi)', () => {
    const r = getAshtakootScore('Ashwini', 'Ashwini');
    expect(r.rawOut36).toBe(28);
    expect(r.hasNadiDosha).toBe(true);
    expect(gunas('Ashwini', 'Ashwini')).toEqual({
      varna: 1, vashya: 2, tara: 3, yoni: 4, maitri: 5, gana: 6, bhakoot: 7, nadi: 0,
    });
  });

  test('every group of nine stars holds three of each nadi in the zig-zag pattern', () => {
    // Stars sharing a nadi score 0; stars from different nadis score 8.
    const nadi = (a, b) => gunas(a, b).nadi;
    expect(nadi('Ashwini', 'Ardra')).toBe(0);        // Adi + Adi
    expect(nadi('Ashwini', 'Uttara Phalguni')).toBe(0);
    expect(nadi('Bharani', 'Mrigashira')).toBe(0);   // Madhya + Madhya
    expect(nadi('Krittika', 'Rohini')).toBe(0);      // Antya + Antya
    expect(nadi('Ashwini', 'Bharani')).toBe(8);
    expect(nadi('Ashwini', 'Krittika')).toBe(8);
    // 9 of each
    const counts = {};
    for (const s of STARS) {
      const key = ['Ashwini', 'Bharani', 'Krittika'].find((ref) => nadi(s, ref) === 0);
      counts[key] = (counts[key] || 0) + 1;
    }
    expect(counts).toEqual({ Ashwini: 9, Bharani: 9, Krittika: 9 });
  });

  test('Tara is good in both directions only when neither count lands on 3, 5 or 7 (mod 9)', () => {
    // Ashwini groom, Krittika bride: 26 -> 8 good, 3 -> bad : one direction good
    expect(gunas('Ashwini', 'Krittika').tara).toBe(1.5);
    // Ashwini / Bharani: 2 and 26 -> 2 and 8, both good
    expect(gunas('Ashwini', 'Bharani').tara).toBe(3);
    // Ashwini / Rohini: 4 and 25 -> 4 and 7, one bad
    expect(gunas('Ashwini', 'Rohini').tara).toBe(1.5);
    // Ashwini / Mrigashira: 5 and 24 -> 5 bad, 6 good
    expect(gunas('Ashwini', 'Mrigashira').tara).toBe(1.5);
    // Ashwini / Ardra: 6 and 23 -> 6 and 5 : one bad
    expect(gunas('Ashwini', 'Ardra').tara).toBe(1.5);
    // Ashwini / Punarvasu: 7 and 22 -> 7 bad, 4 good
    expect(gunas('Ashwini', 'Punarvasu').tara).toBe(1.5);
    // A star counted both ways landing on bad numbers: 3 & 25 -> 3 bad, 7 bad
    expect(gunas('Krittika', 'Ashwini').tara).toBe(1.5);
  });

  test('Yoni uses a symmetric matrix with enemies at 0 and same animal at 4', () => {
    expect(gunas('Ashwini', 'Shatabhisha').yoni).toBe(4);   // horse / horse
    expect(gunas('Ashwini', 'Hasta').yoni).toBe(0);         // horse / buffalo
    expect(gunas('Hasta', 'Ashwini').yoni).toBe(0);
    expect(gunas('Bharani', 'Magha').yoni).toBe(2);          // elephant / rat
    expect(gunas('Rohini', 'Uttara Ashadha').yoni).toBe(0);  // serpent / mongoose
    for (const a of STARS) for (const b of STARS) {
      expect(gunas(a, b).yoni).toBe(gunas(b, a).yoni);
    }
  });

  test('Gana, Varna and Vashya depend on who is the groom', () => {
    // Bride Deva (Ashwini), groom Rakshasa (Krittika) = 1; bride Rakshasa, groom Deva = 0
    expect(gunas('Krittika', 'Ashwini').gana).toBe(1);
    expect(gunas('Ashwini', 'Krittika').gana).toBe(0);
    // Groom Vaishya sign (Vrishabha via Rohini) / bride Brahmin sign (Karka via Pushya)
    expect(gunas({ nakshatra: 'Rohini' }, { nakshatra: 'Pushya' }).varna).toBe(0);
    expect(gunas({ nakshatra: 'Pushya' }, { nakshatra: 'Rohini' }).varna).toBe(1);
  });

  test('Graha Maitri follows the planetary friendship table', () => {
    const maitri = (a, b) => gunas({ nakshatra: 'Ashwini', rashi: a }, { nakshatra: 'Bharani', rashi: b }).maitri;
    expect(maitri('Mesha', 'Vrishchika')).toBe(5);  // same lord
    expect(maitri('Mesha', 'Simha')).toBe(5);       // Mars / Sun friends both ways
    expect(maitri('Mesha', 'Mithuna')).toBe(0.5);   // Mars sees Mercury as enemy, Mercury sees Mars neutral
    expect(maitri('Simha', 'Tula')).toBe(0);        // Sun / Venus enemies both ways
    expect(maitri('Karka', 'Dhanu')).toBe(4);       // Moon-Jupiter: Moon neutral, Jupiter friend
  });

  test('stored rashi is used when both sides have one, otherwise the star decides', () => {
    const stored = getAshtakootScore(
      { nakshatra: 'Ashwini', rashi: 'Mesha' }, { nakshatra: 'Bharani', rashi: 'Meena' },
    );
    const derived = getAshtakootScore('Ashwini', 'Bharani');
    expect(derived.gunas.bhakoot.score).toBe(7);   // both stars sit in Mesha
    expect(stored.gunas.bhakoot.score).toBe(0);    // stored Mesha / Meena is a 2/12 pair
    // only one side gave a rashi: it is ignored, so neither is compared with a guess
    const mixed = getAshtakootScore({ nakshatra: 'Ashwini', rashi: 'Meena' }, 'Bharani');
    expect(mixed.gunas.bhakoot.score).toBe(7);
  });

  test('half points are kept in the total', () => {
    const r = getAshtakootScore('Ashwini', 'Krittika');
    expect(Number.isInteger(r.rawOut36 * 2)).toBe(true);
  });

  test('returns null when either star is unknown', () => {
    expect(getAshtakootScore('Ashwini', null)).toBeNull();
    expect(getAshtakootScore('nonsense', 'Ashwini')).toBeNull();
  });

  test('every pair stays within 0-36', () => {
    for (const a of STARS) for (const b of STARS) {
      const r = getAshtakootScore(a, b);
      expect(r.totalScore).toBeGreaterThanOrEqual(0);
      expect(r.totalScore).toBeLessThanOrEqual(36);
      expect(r.totalMax).toBe(36);
    }
  });
});

describe('getKundliMatch direction', () => {
  const man = { gender: 'male', nakshatra: 'Rohini' };
  const woman = { gender: 'female', nakshatra: 'Pushya' };

  test('same result whichever side asks, when it is one man and one woman', () => {
    const a = getKundliMatch(man, woman);
    const b = getKundliMatch(woman, man);
    expect(a.directionKnown).toBe(true);
    expect(a.totalScore).toBe(b.totalScore);
    expect(a.gunas.varna.score).toBe(0); // groom Vaishya, bride Brahmin
  });

  test('unknown or same-gender pair reports the reverse reading when it differs', () => {
    const r = getKundliMatch({ nakshatra: 'Rohini' }, { nakshatra: 'Pushya' });
    expect(r.directionKnown).toBe(false);
    expect(r.alternate).not.toBeNull();
    expect(r.alternate.totalScore).not.toBe(r.totalScore);
  });

  test('null when the stars are missing', () => {
    expect(getKundliMatch(man, { gender: 'female' })).toBeNull();
  });
});

describe('rashi parsing', () => {
  test.each([
    ['Mesha', 0], ['Mesha (Aries)', 0], ['aries', 0], ['Vrishabha', 1], ['Karka', 3],
    ['Vrishchika', 7], ['Dhanu', 8], ['Kumbha', 10], ['Meena', 11], ['Pisces', 11],
  ])('%s -> %i', (name, idx) => expect(resolveRashi(name)).toBe(idx));

  test('unknown is null, and stored values now feed the rashi fallback', () => {
    expect(resolveRashi('')).toBeNull();
    expect(resolveRashi('xyz')).toBeNull();
    // used to be null for the values the editor actually stores ("Mesha")
    expect(getRashiCompatibility('Mesha', 'Mesha')).toBe(100);
  });
});

describe('buildKundliSummary', () => {
  const base = { manglikCompatible: true, manglikDetail: 'No Manglik dosha', rashiScore: null };

  test('a strong score with no dosha is called strong, with the indicative note', () => {
    const s = buildKundliSummary({ ...base, ashtakoot: { rawOut36: 30, interpretation: 'Very Good' } });
    expect(s).toMatch(/Strong match/);
    expect(s).toMatch(/Indicative only/);
  });

  test.each([['hasNadiDosha', 'Nadi'], ['hasBhakootDosha', 'Bhakoot'], ['hasGanaDosha', 'Gana']])(
    'never praises the match while %s stands',
    (flag, name) => {
      const s = buildKundliSummary({
        ...base, ashtakoot: { rawOut36: 30, interpretation: 'Very Good', [flag]: true },
      });
      expect(s).not.toMatch(/Strong match|Excellent/);
      expect(s).toContain(`${name} Dosha present`);
    },
  );

  test('a Manglik clash blocks the praise', () => {
    const s = buildKundliSummary({
      ...base, manglikCompatible: false, ashtakoot: { rawOut36: 31, interpretation: 'Excellent' },
    });
    expect(s).not.toMatch(/Strong match/);
    expect(s).toMatch(/Manglik/);
  });

  test('plain mode drops the emoji for the PDF', () => {
    const s = buildKundliSummary({ ...base, plain: true, ashtakoot: { rawOut36: 20, interpretation: 'Average', hasNadiDosha: true } });
    expect(s).not.toMatch(/⚠/);
  });

  test('no horoscope data', () => {
    expect(buildKundliSummary({ ...base, ashtakoot: null })).toMatch(/Insufficient/);
  });
});
