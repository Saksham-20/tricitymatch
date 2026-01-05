/**
 * Sophisticated Compatibility Algorithm
 * Calculates compatibility percentage between two profiles based on multiple weighted factors
 */

const calculateAge = (dateOfBirth) => {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

const calculateCompatibility = (profile1, profile2) => {
  let totalScore = 0;
  let maxScore = 0;
  const weights = {
    basic: 0.25,        // Age, height preferences
    lifestyle: 0.20,    // Diet, smoking, drinking
    education: 0.15,    // Education and profession
    location: 0.15,     // City proximity
    personality: 0.15,  // Values and preferences
    family: 0.10        // Family preferences
  };

  // 1. Basic Compatibility (Age, Height) - 25%
  maxScore += weights.basic * 100;
  let basicScore = 0;
  
  const age1 = calculateAge(profile1.dateOfBirth);
  const age2 = calculateAge(profile2.dateOfBirth);
  
  // Age compatibility
  if (profile1.preferredAgeMin && profile1.preferredAgeMax) {
    if (age2 >= profile1.preferredAgeMin && age2 <= profile1.preferredAgeMax) {
      basicScore += 50;
    } else {
      const diff = Math.min(
        Math.abs(age2 - profile1.preferredAgeMin),
        Math.abs(age2 - profile1.preferredAgeMax)
      );
      basicScore += Math.max(0, 50 - diff * 5); // Penalty for age difference
    }
  }
  
  if (profile2.preferredAgeMin && profile2.preferredAgeMax) {
    if (age1 >= profile2.preferredAgeMin && age1 <= profile2.preferredAgeMax) {
      basicScore += 50;
    } else {
      const diff = Math.min(
        Math.abs(age1 - profile2.preferredAgeMin),
        Math.abs(age1 - profile2.preferredAgeMax)
      );
      basicScore += Math.max(0, 50 - diff * 5);
    }
  }
  
  // Height compatibility
  if (profile1.height && profile2.height && profile1.preferredHeightMin && profile1.preferredHeightMax) {
    if (profile2.height >= profile1.preferredHeightMin && profile2.height <= profile1.preferredHeightMax) {
      basicScore += 25;
    }
  }
  
  if (profile2.height && profile1.height && profile2.preferredHeightMin && profile2.preferredHeightMax) {
    if (profile1.height >= profile2.preferredHeightMin && profile1.height <= profile2.preferredHeightMax) {
      basicScore += 25;
    }
  }
  
  totalScore += (basicScore / 100) * weights.basic * 100;

  // 2. Lifestyle Compatibility - 20%
  maxScore += weights.lifestyle * 100;
  let lifestyleScore = 0;
  
  // Diet compatibility
  if (profile1.diet && profile2.diet) {
    if (profile1.diet === profile2.diet) {
      lifestyleScore += 40;
    } else if (
      (profile1.diet === 'vegetarian' && profile2.diet === 'vegan') ||
      (profile1.diet === 'vegan' && profile2.diet === 'vegetarian')
    ) {
      lifestyleScore += 30;
    } else if (profile1.diet === 'jain' || profile2.diet === 'jain') {
      lifestyleScore += 20; // Jain diet is more restrictive
    }
  }
  
  // Smoking compatibility
  if (profile1.smoking && profile2.smoking) {
    if (profile1.smoking === profile2.smoking) {
      lifestyleScore += 30;
    } else if (
      (profile1.smoking === 'never' && profile2.smoking !== 'never') ||
      (profile2.smoking === 'never' && profile1.smoking !== 'never')
    ) {
      lifestyleScore += 0; // Major incompatibility
    } else {
      lifestyleScore += 15;
    }
  }
  
  // Drinking compatibility
  if (profile1.drinking && profile2.drinking) {
    if (profile1.drinking === profile2.drinking) {
      lifestyleScore += 30;
    } else if (
      (profile1.drinking === 'never' && profile2.drinking !== 'never') ||
      (profile2.drinking === 'never' && profile1.drinking !== 'never')
    ) {
      lifestyleScore += 5; // Some incompatibility
    } else {
      lifestyleScore += 20;
    }
  }
  
  totalScore += (lifestyleScore / 100) * weights.lifestyle * 100;

  // 3. Education & Profession - 15%
  maxScore += weights.education * 100;
  let educationScore = 0;
  
  if (profile1.education && profile2.education) {
    if (profile1.education === profile2.education) {
      educationScore += 50;
    } else {
      // Partial match based on education level
      const eduLevels = {
        'phd': 5,
        'masters': 4,
        'bachelors': 3,
        'diploma': 2,
        'high_school': 1
      };
      const level1 = eduLevels[profile1.education.toLowerCase()] || 0;
      const level2 = eduLevels[profile2.education.toLowerCase()] || 0;
      if (Math.abs(level1 - level2) <= 1) {
        educationScore += 30;
      }
    }
  }
  
  if (profile1.profession && profile2.profession) {
    if (profile1.profession === profile2.profession) {
      educationScore += 30;
    } else if (profile1.preferredProfession && profile1.preferredProfession === profile2.profession) {
      educationScore += 20;
    }
  }
  
  if (profile1.preferredEducation && profile2.education) {
    if (profile1.preferredEducation === profile2.education) {
      educationScore += 20;
    }
  }
  
  totalScore += (educationScore / 100) * weights.education * 100;

  // 4. Location Compatibility - 15%
  maxScore += weights.location * 100;
  let locationScore = 0;
  
  const tricityCities = ['Chandigarh', 'Mohali', 'Panchkula'];
  const isTricity1 = tricityCities.includes(profile1.city);
  const isTricity2 = tricityCities.includes(profile2.city);
  
  if (profile1.city === profile2.city) {
    locationScore = 100; // Same city
  } else if (isTricity1 && isTricity2) {
    locationScore = 80; // Both in Tricity
  } else if (
    profile1.preferredCity && 
    profile1.preferredCity.includes(profile2.city)
  ) {
    locationScore = 70; // Matches preferred city
  } else if (
    profile2.preferredCity && 
    profile2.preferredCity.includes(profile1.city)
  ) {
    locationScore = 70;
  } else {
    locationScore = 30; // Different cities
  }
  
  totalScore += (locationScore / 100) * weights.location * 100;

  // 5. Personality & Values - 15%
  maxScore += weights.personality * 100;
  let personalityScore = 0;
  
  if (profile1.personalityValues && profile2.personalityValues) {
    const values1 = profile1.personalityValues;
    const values2 = profile2.personalityValues;
    let matchingValues = 0;
    let totalValues = 0;
    
    for (const key in values1) {
      if (values2.hasOwnProperty(key)) {
        totalValues++;
        if (values1[key] === values2[key]) {
          matchingValues++;
        }
      }
    }
    
    if (totalValues > 0) {
      personalityScore = (matchingValues / totalValues) * 100;
    }
  }
  
  // Lifestyle preferences matching
  if (profile1.lifestylePreferences && profile2.lifestylePreferences) {
    const hobbies1 = profile1.lifestylePreferences.hobbies || [];
    const hobbies2 = profile2.lifestylePreferences.hobbies || [];
    
    if (hobbies1.length > 0 && hobbies2.length > 0) {
      const commonHobbies = hobbies1.filter(h => hobbies2.includes(h));
      const hobbyScore = (commonHobbies.length / Math.max(hobbies1.length, hobbies2.length)) * 30;
      personalityScore += hobbyScore;
    }
  }
  
  totalScore += (personalityScore / 100) * weights.personality * 100;

  // 6. Family Preferences - 10%
  maxScore += weights.family * 100;
  let familyScore = 0;
  
  if (profile1.familyPreferences && profile2.familyPreferences) {
    const fam1 = profile1.familyPreferences;
    const fam2 = profile2.familyPreferences;
    
    // Joint family preference
    if (fam1.jointFamily !== undefined && fam2.jointFamily !== undefined) {
      if (fam1.jointFamily === fam2.jointFamily) {
        familyScore += 50;
      }
    }
    
    // Children preference
    if (fam1.children !== undefined && fam2.children !== undefined) {
      const diff = Math.abs(fam1.children - fam2.children);
      familyScore += Math.max(0, 50 - diff * 10);
    }
  }
  
  totalScore += (familyScore / 100) * weights.family * 100;

  // Calculate final percentage
  const compatibilityPercentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  
  return Math.min(100, Math.max(0, compatibilityPercentage));
};

module.exports = { calculateCompatibility, calculateAge };

