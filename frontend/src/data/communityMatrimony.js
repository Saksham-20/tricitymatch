/**
 * Community × city landing content (2026-08-25 growth pass).
 *
 * WHY THESE PAGES EXIST
 * The national sites own every generic term ("matrimony", "shaadi") and cannot
 * be beaten on them. What they cannot write is the intersection nobody at their
 * scale knows: what a Ramgarhia match in Phase 7 Mohali actually involves. That
 * intersection is the only search we can realistically win, and it is also the
 * search a family here actually types.
 *
 * HOW THE CONTENT IS BUILT
 * Each page renders TWO distinct blocks: the community block below and the
 * city's own locality block (src/data/cityMatrimony.js). Both are specific, so
 * the page is a genuine intersection rather than a slug swap — three
 * near-identical pages read as doorway pages to a search engine and as filler
 * to a human.
 *
 * The visible copy (name, lede, body, points, FAQ) lives in the translation
 * files, i18n/locales/<lng>/cityPages.json under `communities.<slug>`, so it can
 * be shown in English, Hindi or Punjabi. Read it through
 * getCommunityCopy(slug, t) at render time. `seoName` stays here, in English,
 * for the <Seo> title and description.
 *
 * SAME HONESTY BAR AS THE CITY PAGES: no member counts, no "browse N profiles",
 * no activity claims. Nothing here becomes false if the community stays small.
 * Descriptions of custom are written as "how families here tend to do it", not
 * as rules — a matrimonial site telling people their own traditions is both
 * presumptuous and frequently wrong.
 */

export const COMMUNITIES = {
  'jat-sikh': { slug: 'jat-sikh', seoName: 'Jat Sikh' },
  'khatri-arora': { slug: 'khatri-arora', seoName: 'Khatri / Arora' },
  brahmin: { slug: 'brahmin', seoName: 'Brahmin' },
  aggarwal: { slug: 'aggarwal', seoName: 'Aggarwal' },
  ramgarhia: { slug: 'ramgarhia', seoName: 'Ramgarhia' },
};

export const COMMUNITY_SLUGS = Object.keys(COMMUNITIES);

const asList = (value) => (Array.isArray(value) ? value : []);
const asFaq = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : { q: '', a: '' });

/**
 * The community's visible copy in the current language. `t` is the i18next t
 * function from useTranslation().
 */
export const getCommunityCopy = (slug, t) => {
  const key = `cityPages.communities.${slug}`;
  return {
    name: t(`${key}.name`),
    lede: t(`${key}.lede`),
    body: t(`${key}.body`),
    points: asList(t(`${key}.points`, { returnObjects: true })),
    faq: asFaq(t(`${key}.faq`, { returnObjects: true })),
  };
};
