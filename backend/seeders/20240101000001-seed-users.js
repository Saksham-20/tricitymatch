'use strict';
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface, Sequelize) {
    const hashedPassword = await bcrypt.hash('password123', 10);
    const now = new Date();

    // Sample Indian names for Tricity area
    const maleNames = [
      { first: 'Rahul', last: 'Sharma' },
      { first: 'Aman', last: 'Singh' },
      { first: 'Karan', last: 'Kumar' },
      { first: 'Arjun', last: 'Verma' },
      { first: 'Rohit', last: 'Gupta' },
      { first: 'Vikram', last: 'Malhotra' },
      { first: 'Sahil', last: 'Bedi' },
      { first: 'Ankit', last: 'Chopra' },
      { first: 'Harsh', last: 'Sethi' },
      { first: 'Manpreet', last: 'Gill' },
      { first: 'Jaspreet', last: 'Dhillon' },
      { first: 'Gurpreet', last: 'Brar' },
      { first: 'Simran', last: 'Kaur' }, // This is actually a unisex name, but using for male
      { first: 'Harpreet', last: 'Singh' },
      { first: 'Navdeep', last: 'Sidhu' }
    ];

    const femaleNames = [
      { first: 'Priya', last: 'Sharma' },
      { first: 'Anjali', last: 'Singh' },
      { first: 'Kavya', last: 'Kumar' },
      { first: 'Neha', last: 'Verma' },
      { first: 'Riya', last: 'Gupta' },
      { first: 'Sneha', last: 'Malhotra' },
      { first: 'Isha', last: 'Bedi' },
      { first: 'Aanya', last: 'Chopra' },
      { first: 'Meera', last: 'Sethi' },
      { first: 'Simran', last: 'Kaur' },
      { first: 'Harleen', last: 'Gill' },
      { first: 'Gurleen', last: 'Dhillon' },
      { first: 'Navneet', last: 'Brar' },
      { first: 'Jasleen', last: 'Sidhu' },
      { first: 'Manpreet', last: 'Kaur' }
    ];

    const cities = ['Chandigarh', 'Mohali', 'Panchkula'];
    const educations = ['B.Tech', 'MBA', 'M.Tech', 'B.Com', 'M.Com', 'B.Sc', 'M.Sc', 'B.A', 'M.A', 'Ph.D', 'CA', 'MBBS', 'BDS'];
    const professions = ['Software Engineer', 'Doctor', 'Teacher', 'Business Analyst', 'Manager', 'Accountant', 'Lawyer', 'Engineer', 'Designer', 'Consultant', 'Entrepreneur'];
    const interests = ['Travel', 'Music', 'Reading', 'Cooking', 'Fitness', 'Photography', 'Dancing', 'Movies', 'Sports', 'Art', 'Yoga', 'Foodie', 'Adventure'];
    const languages = ['Hindi', 'English', 'Punjabi', 'Urdu'];

    // Generate dates of birth (ages 25-35)
    const generateDOB = (age) => {
      const year = new Date().getFullYear() - age;
      const month = Math.floor(Math.random() * 12);
      const day = Math.floor(Math.random() * 28) + 1;
      return new Date(year, month, day);
    };

    const users = [];
    const profiles = [];
    const subscriptions = [];

    // Create male profiles
    for (let i = 0; i < maleNames.length; i++) {
      const name = maleNames[i];
      const userId = uuidv4();
      const age = 25 + Math.floor(Math.random() * 11);
      const dob = generateDOB(age);
      const hasSubscription = i < 5; // First 5 have subscriptions
      const subscriptionType = hasSubscription ? (i < 2 ? 'elite' : 'premium') : null;

      users.push({
        id: userId,
        email: `${name.first.toLowerCase()}.${name.last.toLowerCase()}${i + 1}@example.com`,
        password: hashedPassword,
        phone: `98765${String(i + 10000).padStart(5, '0')}`,
        role: 'user',
        status: 'active',
        emailVerified: true,
        lastLogin: new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        createdAt: now,
        updatedAt: now
      });

      const userInterests = interests.sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 5) + 3);
      const userLanguages = languages.sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 3) + 1);

      // Build JSONB objects first
      const personalityValuesObj = {
        familyOriented: Math.random() > 0.3,
        careerFocused: Math.random() > 0.5,
        traditional: Math.random() > 0.4
      };
      const familyPreferencesObj = {
        jointFamily: Math.random() > 0.5,
        children: Math.floor(Math.random() * 3)
      };
      const lifestylePreferencesObj = {
        travel: Math.random() > 0.4,
        hobbies: userInterests.slice(0, 3)
      };
      const profilePromptsObj = {
        prompt1: "I'm looking for someone who...",
        answer1: "is understanding, family-oriented, and shares similar values",
        prompt2: "My ideal partner should be...",
        answer2: "educated, independent, and caring"
      };
      const socialMediaLinksObj = hasSubscription ? {
        instagram: `https://instagram.com/${name.first.toLowerCase()}${name.last.toLowerCase()}`,
        linkedin: `https://linkedin.com/in/${name.first.toLowerCase()}-${name.last.toLowerCase()}`
      } : null;

      profiles.push({
        id: uuidv4(),
        userId: userId,
        firstName: name.first,
        lastName: name.last,
        gender: 'male',
        dateOfBirth: dob,
        height: 165 + Math.floor(Math.random() * 20),
        weight: 65 + Math.floor(Math.random() * 20),
        city: cities[Math.floor(Math.random() * cities.length)],
        state: 'Punjab',
        skinTone: ['fair', 'wheatish', 'dark'][Math.floor(Math.random() * 3)],
        diet: ['vegetarian', 'non-vegetarian', 'vegan', 'jain'][Math.floor(Math.random() * 4)],
        smoking: ['never', 'occasionally', 'regularly'][Math.floor(Math.random() * 3)],
        drinking: ['never', 'occasionally', 'regularly'][Math.floor(Math.random() * 3)],
        education: educations[Math.floor(Math.random() * educations.length)],
        degree: 'Computer Science',
        profession: professions[Math.floor(Math.random() * professions.length)],
        income: 300000 + Math.floor(Math.random() * 1000000),
        preferredAgeMin: 22,
        preferredAgeMax: 30,
        preferredHeightMin: 150,
        preferredHeightMax: 170,
        preferredEducation: educations[Math.floor(Math.random() * educations.length)],
        preferredCity: [cities[Math.floor(Math.random() * cities.length)]],
        personalityValues: personalityValuesObj,
        familyPreferences: familyPreferencesObj,
        lifestylePreferences: lifestylePreferencesObj,
        interestTags: userInterests,
        profilePrompts: profilePromptsObj,
        spotifyPlaylist: i % 3 === 0 ? 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M' : null,
        socialMediaLinks: socialMediaLinksObj,
        personalityType: ['INTJ', 'ENFP', 'ISFJ', 'ESTP', 'INFP'][Math.floor(Math.random() * 5)],
        languages: userLanguages,
        bio: `Hi, I'm ${name.first}. I'm a ${professions[Math.floor(Math.random() * professions.length)]} based in ${cities[Math.floor(Math.random() * cities.length)]}. Looking for someone special to share life's journey with.`,
        // Profile photo placeholder for complete profile (using UI Avatars service)
        profilePhoto: `/uploads/photos/default-male-${(i % 5) + 1}.jpg`,
        photos: [`/uploads/photos/default-male-${(i % 5) + 1}.jpg`],
        completionPercentage: 100, // All fields filled = 100%
        isActive: true,
        showPhone: hasSubscription,
        showEmail: hasSubscription,
        createdAt: now,
        updatedAt: now
      });

      if (hasSubscription) {
        const startDate = new Date(now.getTime() - Math.random() * 20 * 24 * 60 * 60 * 1000);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 30);

        subscriptions.push({
          id: uuidv4(),
          userId: userId,
          planType: subscriptionType,
          status: 'active',
          amount: subscriptionType === 'elite' ? 4999 : 2999,
          startDate: startDate,
          endDate: endDate,
          autoRenew: false,
          createdAt: startDate,
          updatedAt: now
        });
      }
    }

    // Create female profiles
    for (let i = 0; i < femaleNames.length; i++) {
      const name = femaleNames[i];
      const userId = uuidv4();
      const age = 23 + Math.floor(Math.random() * 10);
      const dob = generateDOB(age);
      const hasSubscription = i < 6; // First 6 have subscriptions
      const subscriptionType = hasSubscription ? (i < 3 ? 'elite' : 'premium') : null;

      users.push({
        id: userId,
        email: `${name.first.toLowerCase()}.${name.last.toLowerCase()}${i + 1}@example.com`,
        password: hashedPassword,
        phone: `98766${String(i + 10000).padStart(5, '0')}`,
        role: 'user',
        status: 'active',
        emailVerified: true,
        lastLogin: new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        createdAt: now,
        updatedAt: now
      });

      const userInterests = interests.sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 5) + 3);
      const userLanguages = languages.sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 3) + 1);

      // Build JSONB objects first
      const personalityValuesObj = {
        familyOriented: Math.random() > 0.2,
        careerFocused: Math.random() > 0.6,
        traditional: Math.random() > 0.3
      };
      const familyPreferencesObj = {
        jointFamily: Math.random() > 0.4,
        children: Math.floor(Math.random() * 3)
      };
      const lifestylePreferencesObj = {
        travel: Math.random() > 0.3,
        hobbies: userInterests.slice(0, 3)
      };
      const profilePromptsObj = {
        prompt1: "I'm looking for someone who...",
        answer1: "respects family values, is ambitious, and has a good sense of humor",
        prompt2: "My ideal partner should be...",
        answer2: "understanding, supportive, and shares similar life goals"
      };
      const socialMediaLinksObj = hasSubscription ? {
        instagram: `https://instagram.com/${name.first.toLowerCase()}${name.last.toLowerCase()}`,
        linkedin: `https://linkedin.com/in/${name.first.toLowerCase()}-${name.last.toLowerCase()}`
      } : null;

      profiles.push({
        id: uuidv4(),
        userId: userId,
        firstName: name.first,
        lastName: name.last,
        gender: 'female',
        dateOfBirth: dob,
        height: 150 + Math.floor(Math.random() * 20),
        weight: 50 + Math.floor(Math.random() * 15),
        city: cities[Math.floor(Math.random() * cities.length)],
        state: 'Punjab',
        skinTone: ['fair', 'wheatish', 'dark'][Math.floor(Math.random() * 3)],
        diet: ['vegetarian', 'non-vegetarian', 'vegan', 'jain'][Math.floor(Math.random() * 4)],
        smoking: ['never', 'occasionally', 'regularly'][Math.floor(Math.random() * 3)],
        drinking: ['never', 'occasionally', 'regularly'][Math.floor(Math.random() * 3)],
        education: educations[Math.floor(Math.random() * educations.length)],
        degree: 'Computer Science',
        profession: professions[Math.floor(Math.random() * professions.length)],
        income: 250000 + Math.floor(Math.random() * 800000),
        preferredAgeMin: 25,
        preferredAgeMax: 35,
        preferredHeightMin: 165,
        preferredHeightMax: 185,
        preferredEducation: educations[Math.floor(Math.random() * educations.length)],
        preferredCity: [cities[Math.floor(Math.random() * cities.length)]],
        personalityValues: personalityValuesObj,
        familyPreferences: familyPreferencesObj,
        lifestylePreferences: lifestylePreferencesObj,
        interestTags: userInterests,
        profilePrompts: profilePromptsObj,
        spotifyPlaylist: i % 2 === 0 ? 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M' : null,
        socialMediaLinks: socialMediaLinksObj,
        personalityType: ['ENFJ', 'ISFP', 'ESTJ', 'INTP', 'ESFP'][Math.floor(Math.random() * 5)],
        languages: userLanguages,
        bio: `Hello! I'm ${name.first}. A ${professions[Math.floor(Math.random() * professions.length)]} from ${cities[Math.floor(Math.random() * cities.length)]}. Looking for a life partner who values family and growth.`,
        // Profile photo placeholder for complete profile
        profilePhoto: `/uploads/photos/default-female-${(i % 5) + 1}.jpg`,
        photos: [`/uploads/photos/default-female-${(i % 5) + 1}.jpg`],
        completionPercentage: 100, // All fields filled = 100%
        isActive: true,
        showPhone: hasSubscription,
        showEmail: hasSubscription,
        createdAt: now,
        updatedAt: now
      });

      if (hasSubscription) {
        const startDate = new Date(now.getTime() - Math.random() * 20 * 24 * 60 * 60 * 1000);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 30);

        subscriptions.push({
          id: uuidv4(),
          userId: userId,
          planType: subscriptionType,
          status: 'active',
          amount: subscriptionType === 'elite' ? 4999 : 2999,
          startDate: startDate,
          endDate: endDate,
          autoRenew: false,
          createdAt: startDate,
          updatedAt: now
        });
      }
    }

    // Use Model.bulkCreate for proper escaping
    const { User, Profile, Subscription } = require('../models');
    
    await User.bulkCreate(users);
    await Profile.bulkCreate(profiles);
    if (subscriptions.length > 0) {
      await Subscription.bulkCreate(subscriptions);
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Subscriptions', null, {});
    await queryInterface.bulkDelete('Profiles', null, {});
    await queryInterface.bulkDelete('Users', null, {});
  }
};

