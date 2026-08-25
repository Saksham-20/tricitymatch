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
 * SAME HONESTY BAR AS THE CITY PAGES: no member counts, no "browse N profiles",
 * no activity claims. Nothing here becomes false if the community stays small.
 * Descriptions of custom are written as "how families here tend to do it", not
 * as rules — a matrimonial site telling people their own traditions is both
 * presumptuous and frequently wrong.
 */

export const COMMUNITIES = {
  'jat-sikh': {
    slug: 'jat-sikh',
    name: 'Jat Sikh',
    seoName: 'Jat Sikh',
    lede:
      'Jat Sikh families across the Tricity still match largely through people they know — a relative in the village, a family friend two sectors over. What is missing from that network is not trust, it is reach.',
    body:
      'Most families we hear from are looking within a fairly tight set of expectations: a comparable land or professional background, a family the elders can place, and gotra kept clear on both sides. Many keep ties to a home village in Ludhiana, Moga, Sangrur or Patiala district even after two generations in the city, and that village connection is often the first thing checked.',
    points: [
      'Gotra is recorded on the profile and can be excluded from matches on both sides — set it once and it applies to every search.',
      'Families frequently want a match who has stayed close to the faith and to the village connection; both are things you can state plainly on a profile rather than discover on a call.',
      'Punjabi as a first language is common, and the site is fully usable in Punjabi.',
      'NRI matches — Canada, the UK and Australia especially — are ordinary here rather than exceptional, and a profile can declare it up front.',
    ],
    faq: {
      q: 'Can we exclude our own gotra from matches?',
      a: 'Yes. Gotra is a field on the profile and a filter in search, and it can be set to exclude — so matches sharing your gotra simply do not appear, for you or for them.',
    },
  },

  'khatri-arora': {
    slug: 'khatri-arora',
    name: 'Khatri & Arora',
    seoName: 'Khatri / Arora',
    lede:
      'Khatri and Arora families are among the oldest business communities in the Tricity, and matchmaking here has always run on reputation — who the family is, what the family does, who else knows them.',
    body:
      'Conversations tend to move quickly to profession and family business, and a first meeting is often at a family home rather than a restaurant. Many families are Hindu, many are Sikh, and a fair number hold both traditions at once — which is why we do not force a single religion field to carry the whole answer, and why sub-caste is recorded separately from caste.',
    points: [
      'Caste and sub-caste are separate fields, so an Arora family looking within Arora is not shown every Khatri profile and vice versa.',
      'Business and professional background is prominent on the profile — the thing these conversations turn on first.',
      'Both Hindu and Sikh traditions are common in these families; religion and caste are independent filters, not one combined guess.',
      'Manglik status can be recorded and matched where a family follows it, and ignored entirely where they do not.',
    ],
    faq: {
      q: 'We are Arora but follow Sikh traditions. How is that handled?',
      a: 'Religion and caste are separate fields on the profile and separate filters in search, so you can be Sikh by faith and Arora by community without either one being inferred from the other.',
    },
  },

  brahmin: {
    slug: 'brahmin',
    name: 'Brahmin',
    seoName: 'Brahmin',
    lede:
      'For most Brahmin families in the Tricity the horoscope is not a formality — it is the first gate, and a match that fails it does not reach a conversation.',
    body:
      'That makes the order of things different from other communities: kundli details often get exchanged before photographs. Families in Panchkula and the Chandigarh sectors are frequently in teaching, medicine, law or government service, and preference for a similar background is common. Gotra is kept clear on both sides as a matter of course, and a family pandit is usually consulted before anything is agreed.',
    points: [
      'Full Ashtakoot guna matching — all eight kootas, out of 36 — with Manglik and dosha flagged, and a downloadable match report you can take to your family pandit.',
      'Birth date, time and place are recorded properly, so the calculation uses real inputs rather than an approximation.',
      'Gotra is a first-class field and can be excluded from matches on both sides.',
      'Nothing is decided by the score. The report is a starting point for your own astrologer, not a verdict.',
    ],
    faq: {
      q: 'Can we get the kundli matching in writing?',
      a: 'Yes — the full Ashtakoot report, including guna breakdown, Manglik status and numerology, downloads as a PDF you can share with family or take to your pandit.',
    },
  },

  aggarwal: {
    slug: 'aggarwal',
    name: 'Aggarwal',
    seoName: 'Aggarwal',
    lede:
      'Aggarwal families in the Tricity are concentrated in trade, wholesale, real estate and increasingly in professional practice — and matches are usually assessed by both families together, in person, early.',
    body:
      'Gotra out of the traditional eighteen is checked as standard, and families generally look for a comparable business or professional standing on both sides. Panchkula and the Chandigarh sectors carry long-established families; Mohali and Zirakpur have a newer, faster-growing set. Both are a short drive apart, which is precisely why a hyperlocal match is worth more here than a national one.',
    points: [
      'Gotra is recorded and can be excluded from matches on both sides.',
      'Family business and profession sit prominently on the profile, alongside education.',
      'Vegetarian preference is a normal filter rather than an afterthought — diet is a search field.',
      'A guardian can run the search: a parent or sibling gets their own login and a read-only view of shortlists.',
    ],
    faq: {
      q: 'Can my father manage the profile and the shortlist?',
      a: 'Yes. Guardian access gives a parent or sibling their own login to browse and shortlist on your behalf. They never see your conversations.',
    },
  },

  ramgarhia: {
    slug: 'ramgarhia',
    name: 'Ramgarhia',
    seoName: 'Ramgarhia',
    lede:
      'Ramgarhia families across Mohali, Chandigarh and Panchkula carry a strong tradition of skilled trades and engineering — and, more than most communities here, a genuinely global spread.',
    body:
      'A large number of families have close relatives in the UK, Canada or East Africa, so an NRI match is a routine consideration rather than an unusual one. Within the Tricity the community is tightly connected through the gurdwara and through trade networks, which means references are easy to check and reputation travels. Sub-caste is often specified precisely, and gotra is kept clear on both sides.',
    points: [
      'Sub-caste is a separate field from caste, so a preference stated precisely is matched precisely.',
      'NRI status, country of residence and residency status are declared on the profile — no guessing from a phone number.',
      'Punjabi interface throughout, for family members who would rather not use English.',
      'Family groups let both sides bring elders into one conversation once a match is mutual.',
    ],
    faq: {
      q: 'We are looking for a match settled abroad. Is that supported?',
      a: 'Yes. Members living outside India declare it on the profile along with the country and residency status, and it is a filter in search — so an NRI preference is matched rather than inferred.',
    },
  },
};

export const COMMUNITY_SLUGS = Object.keys(COMMUNITIES);
