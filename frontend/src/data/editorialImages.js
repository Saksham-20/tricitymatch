/**
 * Editorial imagery manifest.
 *
 * 2026-09-22: swapped from AI-generated stand-ins to real, licensed
 * photography (owner instruction: "use real photos, take them from
 * websites, give shoutouts if needed"). Every entry below is a real
 * photograph by a named photographer, used under the license printed next
 * to it, credited on the page via `<PhotoCredit>` in `pages/Home.jsx`. None
 * of these people are TricityMatch members and none is presented as one —
 * no name, age, city, quote, verified tick or match percentage is ever
 * composited onto one of these images, in any component, anywhere. `alt: ''`
 * throughout: the images are decorative mood, not informational content, and
 * a screen reader describing a stranger's wedding photo as if it carried
 * meaning here would be its own small dishonesty.
 *
 * Sourcing, so a future swap can verify terms without re-researching:
 *   - City photographs: Wikimedia Commons, CC BY-SA (3.0 or 4.0). That
 *     license requires attribution and share-alike; `credit` + `creditUrl`
 *     below is how this file satisfies the attribution term, not just a
 *     courtesy.
 *   - The hero photograph: Unsplash, under the Unsplash License (free for
 *     commercial use, attribution appreciated, not required). Credited
 *     anyway, per the owner's "give shoutouts if needed" instruction.
 *
 * These are the actual places named in copy elsewhere on the page — Sukhna
 * Lake in Chandigarh, a Mohali coworking tower, the Morni Hills above
 * Panchkula — not generic stand-ins wearing a city's name.
 *
 * Real, consented photography (success-story photos, verification selfies)
 * never lives in this manifest — it is sourced from the API.
 */

const heroCouple = {
  src: '/images/landing/hero-couple.jpg',
  alt: '',
  credit: 'roshan pms',
  creditUrl: 'https://unsplash.com/@roshanpms',
  license: 'Unsplash License',
};

const cities = {
  chandigarh: {
    src: '/images/landing/city-chandigarh.jpg',
    alt: '',
    credit: 'Kritzolina',
    creditUrl: 'https://commons.wikimedia.org/wiki/File:On_Sukhna_Lake_11.jpg',
    license: 'CC BY-SA 4.0',
  },
  mohali: {
    src: '/images/landing/city-mohali.jpg',
    alt: '',
    credit: 'Biggbang Coworking',
    creditUrl: 'https://commons.wikimedia.org/wiki/File:Biggbang_Coworking.jpg',
    license: 'CC BY-SA 4.0',
  },
  panchkula: {
    src: '/images/landing/city-panchkula.jpg',
    alt: '',
    credit: 'Patiala.singh',
    creditUrl: 'https://commons.wikimedia.org/wiki/File:Monsoon_in_Morni_Hills.jpg',
    license: 'CC BY-SA 4.0',
  },
};

export const EDITORIAL_IMAGES = { heroCouple, cities };
