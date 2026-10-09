/**
 * City landing content (Phase S, F3).
 *
 * ONE template renders all three; only this file differs per city. The copy
 * blocks are deliberately DISTINCT per city — three near-identical pages read as
 * doorway pages to a search engine and as filler to a human, and the locality
 * detail (sectors, phases, communities) is the actual differentiator a national
 * matrimonial site cannot write.
 *
 * The visible copy (lede, locality block, FAQs) lives in the translation files,
 * i18n/locales/<lng>/cityPages.json under `cities.<slug>`, so it can be shown in
 * English, Hindi or Punjabi. Read it through getCityCopy(slug, t) at render
 * time — never at module load, since the language can change later. What stays
 * here is the routing data and the <Seo> title/description, which are kept in
 * English for search engines.
 *
 * HARD RULE: no member counts, no "browse N profiles", no activity claims. These
 * pages must survive the same honesty bar as the landing page — anything that
 * would become false if the community stayed small does not belong here.
 */

export const CITIES = {
  chandigarh: {
    slug: 'chandigarh',
    name: 'Chandigarh',
    // <title>/description — kept under ~60/~155 chars.
    seoTitle: 'Matrimony in Chandigarh',
    seoDescription:
      'A verified, family-first matrimonial community for Chandigarh. Live selfie verification, private conversations, and matches close enough for families to actually meet.',
  },

  mohali: {
    slug: 'mohali',
    name: 'Mohali',
    seoTitle: 'Matrimony in Mohali (SAS Nagar)',
    seoDescription:
      'A verified, family-first matrimonial community for Mohali and SAS Nagar. Live selfie verification, private conversations, and matches within driving distance.',
  },

  panchkula: {
    slug: 'panchkula',
    name: 'Panchkula',
    seoTitle: 'Matrimony in Panchkula',
    seoDescription:
      'A verified, family-first matrimonial community for Panchkula. Live selfie verification, private conversations, and matches families can meet the same week.',
  },
};

export const CITY_SLUGS = Object.keys(CITIES);

const asList = (value) => (Array.isArray(value) ? value : []);

/**
 * The city's visible copy in the current language. `t` is the i18next t
 * function from useTranslation().
 */
export const getCityCopy = (slug, t) => {
  const key = `cityPages.cities.${slug}`;
  return {
    name: t(`cityPages.names.${slug}`),
    lede: t(`${key}.lede`),
    locality: {
      heading: t(`${key}.locality.heading`),
      body: t(`${key}.locality.body`),
      points: asList(t(`${key}.locality.points`, { returnObjects: true })),
    },
    faqs: asList(t(`${key}.faqs`, { returnObjects: true })),
  };
};
