const { Profile, Preference } = require('../models');

/**
 * Calculate compatibility percentage between two profiles
 * @param {Object} profile1 - First user's profile
 * @param {Object} profile2 - Second user's profile
 * @param {Object} preference1 - First user's preferences
 * @param {Object} preference2 - Second user's preferences
 * @returns {number} Compatibility percentage (0-100)
 */
const calculateCompatibility = (profile1, profile2, preference1, preference2) => {
  let score = 0;
  let totalWeight = 0;

  // 1. Personality Answers Match (40% weight)
  if (profile1.personalityAnswers && profile2.personalityAnswers) {
    const personalityScore = calculatePersonalityMatch(
      profile1.personalityAnswers, 
      profile2.personalityAnswers
    );
    score += personalityScore * 0.4;
    totalWeight += 0.4;
  }

  // 2. Preferences Match (30% weight)
  const preferencesScore1 = calculatePreferencesMatch(profile1, preference2);
  const preferencesScore2 = calculatePreferencesMatch(profile2, preference1);
  const avgPreferencesScore = (preferencesScore1 + preferencesScore2) / 2;
  score += avgPreferencesScore * 0.3;
  totalWeight += 0.3;

  // 3. Lifestyle Compatibility (20% weight)
  const lifestyleScore = calculateLifestyleMatch(profile1, profile2);
  score += lifestyleScore * 0.2;
  totalWeight += 0.2;

  // 4. Location Proximity (10% weight)
  const locationScore = calculateLocationMatch(profile1, profile2);
  score += locationScore * 0.1;
  totalWeight += 0.1;

  // Normalize score based on available data
  return totalWeight > 0 ? Math.round((score / totalWeight) * 100) : 0;
};

/**
 * Calculate personality match based on answers
 */
const calculatePersonalityMatch = (answers1, answers2) => {
  const questions = Object.keys(answers1);
  let matches = 0;
  let totalQuestions = 0;

  questions.forEach(question => {
    if (answers2[question]) {
      totalQuestions++;
      if (answers1[question] === answers2[question]) {
        matches++;
      }
    }
  });

  return totalQuestions > 0 ? (matches / totalQuestions) * 100 : 0;
};

/**
 * Calculate how well a profile matches preferences
 */
const calculatePreferencesMatch = (profile, preferences) => {
  if (!preferences) return 50; // Neutral score if no preferences set

  let score = 0;
  let factors = 0;

  // Age match
  if (preferences.ageMin || preferences.ageMax) {
    const age = profile.calculateAge();
    if (preferences.isAgeMatch(age)) {
      score += 100;
    } else {
      score += 50; // Partial score for close matches
    }
    factors++;
  }

  // Height match
  if (preferences.heightMin || preferences.heightMax) {
    if (preferences.isHeightMatch(profile.height)) {
      score += 100;
    } else {
      score += 50;
    }
    factors++;
  }

  // Religion match
  if (preferences.religion && profile.religion) {
    if (preferences.religion === profile.religion || preferences.religion === 'any') {
      score += 100;
    } else {
      score += 0;
    }
    factors++;
  }

  // Education match
  if (preferences.education && profile.education) {
    if (preferences.education === profile.education || preferences.education === 'any') {
      score += 100;
    } else {
      score += 50;
    }
    factors++;
  }

  // Income match
  if (preferences.incomeMin || preferences.incomeMax) {
    if (preferences.isIncomeMatch(profile.income)) {
      score += 100;
    } else {
      score += 50;
    }
    factors++;
  }

  return factors > 0 ? score / factors : 50;
};

/**
 * Calculate lifestyle compatibility
 */
const calculateLifestyleMatch = (profile1, profile2) => {
  let score = 0;
  let factors = 0;

  // Diet compatibility
  if (profile1.diet && profile2.diet) {
    if (profile1.diet === profile2.diet) {
      score += 100;
    } else if (
      (profile1.diet === 'vegetarian' && profile2.diet === 'jain') ||
      (profile1.diet === 'jain' && profile2.diet === 'vegetarian')
    ) {
      score += 80; // High compatibility
    } else if (
      (profile1.diet === 'vegetarian' && profile2.diet === 'non-vegetarian') ||
      (profile1.diet === 'non-vegetarian' && profile2.diet === 'vegetarian')
    ) {
      score += 30; // Lower compatibility
    } else {
      score += 50; // Neutral
    }
    factors++;
  }

  // Smoking compatibility
  if (profile1.smoking && profile2.smoking) {
    if (profile1.smoking === profile2.smoking) {
      score += 100;
    } else if (
      (profile1.smoking === 'no' && profile2.smoking === 'occasionally') ||
      (profile1.smoking === 'occasionally' && profile2.smoking === 'no')
    ) {
      score += 70;
    } else {
      score += 20;
    }
    factors++;
  }

  // Drinking compatibility
  if (profile1.drinking && profile2.drinking) {
    if (profile1.drinking === profile2.drinking) {
      score += 100;
    } else if (
      (profile1.drinking === 'no' && profile2.drinking === 'occasionally') ||
      (profile1.drinking === 'occasionally' && profile2.drinking === 'no')
    ) {
      score += 70;
    } else {
      score += 20;
    }
    factors++;
  }

  return factors > 0 ? score / factors : 50;
};

/**
 * Calculate location proximity match
 */
const calculateLocationMatch = (profile1, profile2) => {
  if (!profile1.city || !profile2.city) return 50;

  const tricityCities = ['Chandigarh', 'Mohali', 'Panchkula'];
  const nearbyCities = ['Zirakpur', 'Kharar', 'Derabassi', 'Kalka', 'Ambala'];

  // Same city
  if (profile1.city === profile2.city) {
    return 100;
  }

  // Both in Tricity
  if (tricityCities.includes(profile1.city) && tricityCities.includes(profile2.city)) {
    return 90;
  }

  // One in Tricity, one nearby
  if (
    (tricityCities.includes(profile1.city) && nearbyCities.includes(profile2.city)) ||
    (nearbyCities.includes(profile1.city) && tricityCities.includes(profile2.city))
  ) {
    return 80;
  }

  // Both nearby
  if (nearbyCities.includes(profile1.city) && nearbyCities.includes(profile2.city)) {
    return 70;
  }

  // Different regions
  return 30;
};

/**
 * Calculate Kundli compatibility (simplified version)
 */
const calculateKundliCompatibility = (kundli1, kundli2) => {
  if (!kundli1 || !kundli2) return 50;

  let score = 0;
  let factors = 0;

  // Rashi (Moon sign) compatibility
  if (kundli1.rashi && kundli2.rashi) {
    const compatibleRashis = {
      'Aries': ['Leo', 'Sagittarius', 'Gemini', 'Aquarius'],
      'Taurus': ['Virgo', 'Capricorn', 'Cancer', 'Pisces'],
      'Gemini': ['Libra', 'Aquarius', 'Aries', 'Leo'],
      'Cancer': ['Scorpio', 'Pisces', 'Taurus', 'Virgo'],
      'Leo': ['Sagittarius', 'Aries', 'Gemini', 'Libra'],
      'Virgo': ['Capricorn', 'Taurus', 'Cancer', 'Scorpio'],
      'Libra': ['Aquarius', 'Gemini', 'Leo', 'Sagittarius'],
      'Scorpio': ['Pisces', 'Cancer', 'Virgo', 'Capricorn'],
      'Sagittarius': ['Aries', 'Leo', 'Libra', 'Aquarius'],
      'Capricorn': ['Taurus', 'Virgo', 'Scorpio', 'Pisces'],
      'Aquarius': ['Gemini', 'Libra', 'Sagittarius', 'Aries'],
      'Pisces': ['Cancer', 'Scorpio', 'Capricorn', 'Taurus']
    };

    if (compatibleRashis[kundli1.rashi]?.includes(kundli2.rashi)) {
      score += 100;
    } else {
      score += 50;
    }
    factors++;
  }

  // Nakshatra compatibility (simplified)
  if (kundli1.nakshatra && kundli2.nakshatra) {
    // This would require a more complex calculation
    // For now, return a random score between 60-90
    score += 75;
    factors++;
  }

  return factors > 0 ? score / factors : 50;
};

module.exports = {
  calculateCompatibility,
  calculateKundliCompatibility
};
