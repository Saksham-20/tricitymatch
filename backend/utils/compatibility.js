/**
 * Compatibility Calculator
 * Calculates compatibility score between two profiles
 */

// Calculate age from date of birth
const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

// Calculate compatibility between two profiles
const calculateCompatibility = (profile1, profile2) => {
  if (!profile1 || !profile2) return 0;

  let score = 0;
  let maxScore = 0;

  // ===== AGE COMPATIBILITY (20 points) =====
  maxScore += 20;
  const age1 = calculateAge(profile1.dateOfBirth);
  const age2 = calculateAge(profile2.dateOfBirth);
  
  if (age1 && age2) {
    const ageDiff = Math.abs(age1 - age2);
    if (ageDiff <= 2) score += 20;
    else if (ageDiff <= 5) score += 15;
    else if (ageDiff <= 8) score += 10;
    else if (ageDiff <= 12) score += 5;
  }

  // ===== LOCATION COMPATIBILITY (15 points) =====
  maxScore += 15;
  if (profile1.city && profile2.city) {
    if (profile1.city.toLowerCase() === profile2.city.toLowerCase()) {
      score += 15;
    } else if (profile1.state && profile2.state && 
               profile1.state.toLowerCase() === profile2.state.toLowerCase()) {
      score += 8;
    }
  }

  // ===== HEIGHT COMPATIBILITY (10 points) =====
  maxScore += 10;
  if (profile1.height && profile2.height) {
    const heightDiff = Math.abs(profile1.height - profile2.height);
    if (heightDiff <= 5) score += 10;
    else if (heightDiff <= 10) score += 8;
    else if (heightDiff <= 15) score += 5;
    else if (heightDiff <= 20) score += 3;
  }

  // ===== EDUCATION COMPATIBILITY (15 points) =====
  maxScore += 15;
  if (profile1.education && profile2.education) {
    const educationLevels = {
      'high school': 1,
      'diploma': 2,
      'bachelor': 3,
      'graduate': 3,
      'master': 4,
      'postgraduate': 4,
      'doctorate': 5,
      'phd': 5
    };

    const getEducationLevel = (edu) => {
      const eduLower = edu.toLowerCase();
      for (const [key, value] of Object.entries(educationLevels)) {
        if (eduLower.includes(key)) return value;
      }
      return 2; // Default to diploma level
    };

    const level1 = getEducationLevel(profile1.education);
    const level2 = getEducationLevel(profile2.education);
    const levelDiff = Math.abs(level1 - level2);

    if (levelDiff === 0) score += 15;
    else if (levelDiff === 1) score += 12;
    else if (levelDiff === 2) score += 8;
    else score += 4;
  }

  // ===== LIFESTYLE COMPATIBILITY (30 points) =====
  maxScore += 30;
  
  // Diet (10 points)
  if (profile1.diet && profile2.diet) {
    if (profile1.diet === profile2.diet) {
      score += 10;
    } else if (
      (profile1.diet === 'vegetarian' && profile2.diet === 'vegan') ||
      (profile1.diet === 'vegan' && profile2.diet === 'vegetarian')
    ) {
      score += 7;
    } else {
      score += 3;
    }
  }

  // Smoking (10 points)
  if (profile1.smoking && profile2.smoking) {
    if (profile1.smoking === profile2.smoking) {
      score += 10;
    } else if (profile1.smoking === 'never' || profile2.smoking === 'never') {
      score += 3;
    } else {
      score += 6;
    }
  }

  // Drinking (10 points)
  if (profile1.drinking && profile2.drinking) {
    if (profile1.drinking === profile2.drinking) {
      score += 10;
    } else if (
      (profile1.drinking === 'never' && profile2.drinking === 'occasionally') ||
      (profile1.drinking === 'occasionally' && profile2.drinking === 'never')
    ) {
      score += 7;
    } else {
      score += 4;
    }
  }

  // ===== INTEREST TAGS COMPATIBILITY (10 points) =====
  maxScore += 10;
  if (profile1.interestTags?.length && profile2.interestTags?.length) {
    const tags1 = new Set(profile1.interestTags.map(t => t.toLowerCase()));
    const tags2 = new Set(profile2.interestTags.map(t => t.toLowerCase()));
    
    let commonTags = 0;
    for (const tag of tags1) {
      if (tags2.has(tag)) commonTags++;
    }
    
    const overlapPercentage = (commonTags * 2) / (tags1.size + tags2.size);
    score += Math.round(overlapPercentage * 10);
  }

  // ===== PREFERENCE MATCHING (bonus points) =====
  // Check if profile2 matches profile1's preferences
  
  // Age preferences
  if (profile1.preferredAgeMin && profile1.preferredAgeMax && age2) {
    if (age2 >= profile1.preferredAgeMin && age2 <= profile1.preferredAgeMax) {
      score += 5;
      maxScore += 5;
    }
  }

  // Height preferences
  if (profile1.preferredHeightMin && profile1.preferredHeightMax && profile2.height) {
    if (profile2.height >= profile1.preferredHeightMin && profile2.height <= profile1.preferredHeightMax) {
      score += 5;
      maxScore += 5;
    }
  }

  // City preference
  if (profile1.preferredCity && profile2.city) {
    if (Array.isArray(profile1.preferredCity)) {
      if (profile1.preferredCity.some(c => c.toLowerCase() === profile2.city.toLowerCase())) {
        score += 3;
        maxScore += 3;
      }
    } else if (profile1.preferredCity.toLowerCase() === profile2.city.toLowerCase()) {
      score += 3;
      maxScore += 3;
    }
  }

  // Calculate final percentage
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  // Ensure score is between 0-100
  return Math.max(0, Math.min(100, percentage));
};

// Get compatibility breakdown for detailed view
const getCompatibilityBreakdown = (profile1, profile2) => {
  if (!profile1 || !profile2) return null;

  const breakdown = {
    overall: calculateCompatibility(profile1, profile2),
    categories: {}
  };

  // Age
  const age1 = calculateAge(profile1.dateOfBirth);
  const age2 = calculateAge(profile2.dateOfBirth);
  if (age1 && age2) {
    const ageDiff = Math.abs(age1 - age2);
    breakdown.categories.age = {
      score: ageDiff <= 2 ? 100 : ageDiff <= 5 ? 75 : ageDiff <= 8 ? 50 : ageDiff <= 12 ? 25 : 0,
      detail: `${ageDiff} years difference`
    };
  }

  // Location
  if (profile1.city && profile2.city) {
    const sameCity = profile1.city.toLowerCase() === profile2.city.toLowerCase();
    const sameState = profile1.state && profile2.state && 
                      profile1.state.toLowerCase() === profile2.state.toLowerCase();
    breakdown.categories.location = {
      score: sameCity ? 100 : sameState ? 50 : 0,
      detail: sameCity ? 'Same city' : sameState ? 'Same state' : 'Different locations'
    };
  }

  // Lifestyle
  const lifestyleMatches = [];
  if (profile1.diet === profile2.diet) lifestyleMatches.push('diet');
  if (profile1.smoking === profile2.smoking) lifestyleMatches.push('smoking');
  if (profile1.drinking === profile2.drinking) lifestyleMatches.push('drinking');
  
  breakdown.categories.lifestyle = {
    score: Math.round((lifestyleMatches.length / 3) * 100),
    detail: lifestyleMatches.length > 0 
      ? `Matching: ${lifestyleMatches.join(', ')}` 
      : 'Different lifestyle preferences'
  };

  return breakdown;
};

module.exports = {
  calculateCompatibility,
  getCompatibilityBreakdown,
  calculateAge
};
