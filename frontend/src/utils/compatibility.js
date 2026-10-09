import i18n from '../i18n';

// Frontend compatibility utility (mirrors backend logic for display)
export const formatCompatibilityScore = (score) => {
  if (!score) return null;
  
  if (score >= 90) return { text: i18n.t('matching.score.excellent'), color: 'text-green-600', bg: 'bg-green-100' };
  if (score >= 75) return { text: i18n.t('matching.score.great'), color: 'text-blue-600', bg: 'bg-blue-100' };
  if (score >= 60) return { text: i18n.t('matching.score.good'), color: 'text-yellow-600', bg: 'bg-yellow-100' };
  return { text: i18n.t('matching.score.fair'), color: 'text-orange-600', bg: 'bg-orange-100' };
};
