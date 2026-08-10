/**
 * City landing content (Phase S, F3).
 *
 * ONE template renders all three; only this file differs per city. The copy
 * blocks are deliberately DISTINCT per city — three near-identical pages read as
 * doorway pages to a search engine and as filler to a human, and the locality
 * detail (sectors, phases, communities) is the actual differentiator a national
 * matrimonial site cannot write.
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
    lede:
      'A planned city where families still match the old way — through people they know. TricityMatch keeps that intact and adds the one thing word-of-mouth cannot: a verified profile you can check before anyone picks up the phone.',
    locality: {
      heading: 'What matchmaking in Chandigarh actually looks like',
      body:
        'A Sector 8 family and a Sector 44 family are a fifteen-minute drive apart, and that changes everything about how a match progresses. Meetings happen the same week, not the same quarter. Elders come along. The sector a family has lived in for thirty years carries as much context as any biodata line.',
      points: [
        'Sector-wise proximity means first meetings happen in person, quickly — usually with family present.',
        'Punjabi, Hindi and English-speaking families, with strong Sikh, Hindu and Jain communities across the sectors.',
        'Government service, PGI and Panjab University academia, law, and a young IT-and-startup cohort in the southern sectors.',
        'Gotra, caste and Manglik preferences are set by the families themselves — we filter on what you tell us, and never assume.',
      ],
    },
    faqs: [
      {
        q: 'Do you only cover Chandigarh?',
        a: 'We cover Chandigarh, Mohali and Panchkula — and nothing else. A single-district focus is the point: a match is only useful if the two families can reasonably meet.',
      },
      {
        q: 'Can parents or a guardian handle the profile?',
        a: 'Yes. A parent, sibling or guardian can create and manage a profile on someone’s behalf, and a member can invite family to view their matches with a read-only guardian link.',
      },
      {
        q: 'How do you check that a profile is real?',
        a: 'The verified badge is earned with a live selfie captured in the app — never an uploaded file — which our team matches by hand against the profile photos. Uploads can be doctored; a live capture is far harder to fake.',
      },
      {
        q: 'Is horoscope and gotra matching supported?',
        a: 'Yes. Ashtakoot guna matching, Manglik status and gotra exclusions are built in, and a full Kundli match report can be downloaded for any profile.',
      },
    ],
  },

  mohali: {
    slug: 'mohali',
    name: 'Mohali',
    seoTitle: 'Matrimony in Mohali (SAS Nagar)',
    seoDescription:
      'A verified, family-first matrimonial community for Mohali and SAS Nagar. Live selfie verification, private conversations, and matches within driving distance.',
    lede:
      'Mohali grew fast, and its families are split between the old phases and the new sectors along the Airport Road. TricityMatch is built for exactly that mix — same city, same weekend, families who can meet each other properly.',
    locality: {
      heading: 'What matchmaking in Mohali actually looks like',
      body:
        'Mohali runs on two clocks. The older phases hold families who have been here for decades, with settled community networks. The newer sectors and the Aerocity–Airport Road belt hold younger professionals, many the first in their family to work in IT or healthcare. A good match here often crosses that line — and the platform should not pretend the two are the same.',
      points: [
        'Phases 1–11 and the newer sectors read as different neighbourhoods to families — both are covered, and city is a filter you control.',
        'A large Sikh-Punjabi base alongside families who moved in for work from across the region.',
        'IT parks, the Quark/Rajiv Gandhi tech belt, healthcare and a substantial NRI cohort with family still in Mohali.',
        'NRI members declare their status at signup, so “settled abroad, family in Mohali” is something you can see rather than guess.',
      ],
    },
    faqs: [
      {
        q: 'Does Mohali include SAS Nagar, Kharar and Zirakpur?',
        a: 'Mohali on TricityMatch means SAS Nagar and its phases and sectors. Neighbouring towns are outside the Tricity focus for now — we would rather cover three cities properly than five badly.',
      },
      {
        q: 'I live abroad but my family is in Mohali. Does that work?',
        a: 'Yes. NRI members declare their status during signup, and families searching locally can see it up front instead of finding out three conversations in.',
      },
      {
        q: 'How private are conversations?',
        a: 'Messages are encrypted in transit and your phone number is never shown to another member. Contact details are only shared when you choose to unlock them.',
      },
      {
        q: 'What does it cost to join?',
        a: 'Creating a profile, browsing and expressing interest are free. Paid plans exist for contact unlocks and messaging — with the price and what it includes shown before you pay, never after.',
      },
    ],
  },

  panchkula: {
    slug: 'panchkula',
    name: 'Panchkula',
    seoTitle: 'Matrimony in Panchkula',
    seoDescription:
      'A verified, family-first matrimonial community for Panchkula. Live selfie verification, private conversations, and matches families can meet the same week.',
    lede:
      'Panchkula is the quietest corner of the Tricity and the most family-led in how matches are made. Introductions still travel through relatives and neighbours — we simply make the first check a verified profile instead of a phone call.',
    locality: {
      heading: 'What matchmaking in Panchkula actually looks like',
      body:
        'Families here tend to move deliberately: an introduction is discussed at home well before anyone meets. That suits a platform where parents and guardians can take part openly rather than looking over a shoulder. Being minutes from both Chandigarh and Mohali means a Panchkula family is rarely limited to Panchkula matches.',
      points: [
        'Sectors 1–28 plus the Pinjore–Kalka side, with strong Haryanvi, Punjabi and Hindi-speaking family networks.',
        'Government service, Chandigarh-based professionals commuting daily, business families and the education sector.',
        'Guardian access is built in — a parent can view matches and shortlists read-only, without taking over the account.',
        'Cross-Tricity by default: Panchkula families routinely meet Chandigarh and Mohali families the same week.',
      ],
    },
    faqs: [
      {
        q: 'Can I see matches from Chandigarh and Mohali too?',
        a: 'Yes — all three cities are one community. City is a filter, not a wall, so you can keep it tight or open it up as you like.',
      },
      {
        q: 'Can my parents see my matches?',
        a: 'Only if you invite them. A guardian link gives a parent or sibling read-only access to your matches and shortlist — they can advise, but they cannot message anyone as you.',
      },
      {
        q: 'What happens if someone behaves badly?',
        a: 'Block and Report are on every profile. Reported profiles go to a human safety queue, and a member who is removed loses access to their conversations.',
      },
      {
        q: 'Do I have to get verified?',
        a: 'No, but verified profiles carry a badge and can be filtered for, so they get taken more seriously. It takes about a minute with a live selfie.',
      },
    ],
  },
};

export const CITY_SLUGS = Object.keys(CITIES);
