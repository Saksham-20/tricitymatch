/**
 * Editorial imagery manifest — doctrine ruling 15 override (owner decision,
 * 2026-09-17): the landing photography is AI-generated for now, real
 * photography to follow. This is the single place that fact is recorded.
 *
 * Every image any public page renders as ambient art direction (never a
 * member, never a claim) is described here as { src, alt, aiGenerated }.
 * `<AiTag>` (defined in pages/Home.jsx, the only consumer) reads
 * `aiGenerated` off the entry it is given, so the small on-image caption
 * disappears on its own the moment an entry is swapped for a licensed or
 * consented photograph — nobody has to remember to delete a caption.
 * If a second page ever renders manifest imagery, lift AiTag into
 * components/common/ first so the disclosure cannot be forgotten there.
 *
 * These are ambient only: no name, age, city, quote, verified tick or match
 * percentage is ever composited onto one of these images, in any component,
 * anywhere. `alt: ''` throughout — the images are decorative mood, not
 * informational content, and a screen reader describing an invented person
 * would be its own small dishonesty.
 *
 * Real, consented photography (success-story photos, verification selfies)
 * never lives in this manifest — it is sourced from the API and is exempt
 * from the AI disclosure because it is not AI-generated.
 */

const heroStack = {
  back: { src: '/images/landing/profile-anjali.jpg', alt: '', aiGenerated: true },
  mid: { src: '/images/landing/profile-rahul.jpg', alt: '', aiGenerated: true },
  front: { src: '/images/landing/profile-priya.jpg', alt: '', aiGenerated: true },
};

const discoverGallery = [
  { src: '/images/landing/profile-priya.jpg', alt: '', aiGenerated: true },
  { src: '/images/landing/profile-rahul.jpg', alt: '', aiGenerated: true },
  { src: '/images/landing/profile-anjali.jpg', alt: '', aiGenerated: true },
  { src: '/images/landing/profile-karan.jpg', alt: '', aiGenerated: true },
  { src: '/images/landing/profile-meera.jpg', alt: '', aiGenerated: true },
];

const cities = {
  chandigarh: { src: '/images/landing/city-chandigarh.jpg', alt: '', aiGenerated: true },
  mohali: { src: '/images/landing/city-mohali.jpg', alt: '', aiGenerated: true },
  panchkula: { src: '/images/landing/city-panchkula.jpg', alt: '', aiGenerated: true },
};

export const EDITORIAL_IMAGES = { heroStack, discoverGallery, cities };
