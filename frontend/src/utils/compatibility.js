// Frontend compatibility utility (mirrors backend logic for display)
export const formatCompatibilityScore = (score) => {
  if (!score) return null;
  
  if (score >= 90) return { text: 'Excellent Match', color: 'text-green-600', bg: 'bg-green-100' };
  if (score >= 75) return { text: 'Great Match', color: 'text-blue-600', bg: 'bg-blue-100' };
  if (score >= 60) return { text: 'Good Match', color: 'text-yellow-600', bg: 'bg-yellow-100' };
  return { text: 'Fair Match', color: 'text-orange-600', bg: 'bg-orange-100' };
};

