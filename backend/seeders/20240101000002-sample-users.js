'use strict';
const bcrypt = require('bcryptjs');

module.exports = {
  async up(queryInterface, Sequelize) {
    // Create sample users
    const sampleUsers = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        email: 'priya.sharma@example.com',
        password: await bcrypt.hash('password123', 12),
        phone: '+919876543211',
        role: 'user',
        isVerified: true,
        isEmailVerified: true,
        subscriptionType: 'premium',
        subscriptionExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        email: 'rahul.singh@example.com',
        password: await bcrypt.hash('password123', 12),
        phone: '+919876543212',
        role: 'user',
        isVerified: true,
        isEmailVerified: true,
        subscriptionType: 'free',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '33333333-3333-3333-3333-333333333333',
        email: 'anjali.gupta@example.com',
        password: await bcrypt.hash('password123', 12),
        phone: '+919876543213',
        role: 'user',
        isVerified: false,
        isEmailVerified: true,
        subscriptionType: 'elite',
        subscriptionExpiry: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    await queryInterface.bulkInsert('Users', sampleUsers);

    // Create sample profiles
    const sampleProfiles = [
      {
        id: '44444444-4444-4444-4444-444444444444',
        userId: '11111111-1111-1111-1111-111111111111',
        name: 'Priya Sharma',
        gender: 'female',
        dob: '1995-06-15',
        height: 165,
        weight: 55,
        religion: 'Hindu',
        caste: 'Brahmin',
        community: 'Punjabi',
        skinTone: 'fair',
        diet: 'vegetarian',
        smoking: 'no',
        drinking: 'no',
        education: 'Post Graduate',
        profession: 'Software Engineer',
        income: 800000,
        city: 'Chandigarh',
        bio: 'Looking for a life partner who shares similar values and interests. Love traveling and reading books.',
        photos: JSON.stringify([
          {
            id: '1',
            url: '/uploads/samples/priya-1.jpg',
            isPrimary: true,
            uploadedAt: new Date().toISOString()
          },
          {
            id: '2',
            url: '/uploads/samples/priya-2.jpg',
            isPrimary: false,
            uploadedAt: new Date().toISOString()
          }
        ]),
        personalityAnswers: JSON.stringify({
          values: 'family',
          lifestyle: 'balanced',
          hobbies: 'reading, traveling, cooking',
          weekend: 'family time',
          religion_importance: 'very'
        }),
        verificationStatus: 'verified',
        verificationDocs: JSON.stringify({}),
        birthTime: '10:30:00',
        birthPlace: 'Chandigarh',
        kundliData: JSON.stringify({
          rashi: 'Cancer',
          nakshatra: 'Pushya',
          ascendant: 'Leo'
        }),
        isProfileComplete: true,
        profileCompletionPercentage: 95,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '55555555-5555-5555-5555-555555555555',
        userId: '22222222-2222-2222-2222-222222222222',
        name: 'Rahul Singh',
        gender: 'male',
        dob: '1992-03-22',
        height: 180,
        weight: 75,
        religion: 'Sikh',
        caste: 'Jat',
        community: 'Punjabi',
        skinTone: 'wheatish',
        diet: 'non-vegetarian',
        smoking: 'no',
        drinking: 'occasionally',
        education: 'Graduate',
        profession: 'Business Owner',
        income: 1200000,
        city: 'Mohali',
        bio: 'Entrepreneur looking for a supportive life partner. Love sports and outdoor activities.',
        photos: JSON.stringify([
          {
            id: '1',
            url: '/uploads/samples/rahul-1.jpg',
            isPrimary: true,
            uploadedAt: new Date().toISOString()
          }
        ]),
        personalityAnswers: JSON.stringify({
          values: 'career',
          lifestyle: 'active',
          hobbies: 'cricket, business, music',
          weekend: 'sports',
          religion_importance: 'somewhat'
        }),
        verificationStatus: 'pending',
        verificationDocs: JSON.stringify({}),
        birthTime: '14:15:00',
        birthPlace: 'Mohali',
        kundliData: JSON.stringify({
          rashi: 'Aries',
          nakshatra: 'Bharani',
          ascendant: 'Scorpio'
        }),
        isProfileComplete: true,
        profileCompletionPercentage: 85,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '66666666-6666-6666-6666-666666666666',
        userId: '33333333-3333-3333-3333-333333333333',
        name: 'Anjali Gupta',
        gender: 'female',
        dob: '1994-11-08',
        height: 160,
        weight: 52,
        religion: 'Hindu',
        caste: 'Agarwal',
        community: 'Marwari',
        skinTone: 'fair',
        diet: 'vegetarian',
        smoking: 'no',
        drinking: 'no',
        education: 'Post Graduate',
        profession: 'Doctor',
        income: 1500000,
        city: 'Panchkula',
        bio: 'Doctor by profession, looking for an educated and understanding life partner.',
        photos: JSON.stringify([
          {
            id: '1',
            url: '/uploads/samples/anjali-1.jpg',
            isPrimary: true,
            uploadedAt: new Date().toISOString()
          },
          {
            id: '2',
            url: '/uploads/samples/anjali-2.jpg',
            isPrimary: false,
            uploadedAt: new Date().toISOString()
          },
          {
            id: '3',
            url: '/uploads/samples/anjali-3.jpg',
            isPrimary: false,
            uploadedAt: new Date().toISOString()
          }
        ]),
        personalityAnswers: JSON.stringify({
          values: 'education',
          lifestyle: 'professional',
          hobbies: 'medicine, reading, yoga',
          weekend: 'relaxation',
          religion_importance: 'very'
        }),
        verificationStatus: 'verified',
        verificationDocs: JSON.stringify({}),
        birthTime: '08:45:00',
        birthPlace: 'Panchkula',
        kundliData: JSON.stringify({
          rashi: 'Scorpio',
          nakshatra: 'Anuradha',
          ascendant: 'Pisces'
        }),
        isProfileComplete: true,
        profileCompletionPercentage: 100,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    await queryInterface.bulkInsert('Profiles', sampleProfiles);

    // Create sample preferences
    const samplePreferences = [
      {
        id: '77777777-7777-7777-7777-777777777777',
        userId: '11111111-1111-1111-1111-111111111111',
        ageMin: 28,
        ageMax: 35,
        heightMin: 170,
        heightMax: 185,
        religion: 'Hindu',
        caste: 'any',
        education: 'Graduate',
        profession: 'any',
        incomeMin: 600000,
        incomeMax: 1500000,
        city: 'Chandigarh',
        diet: 'vegetarian',
        smoking: 'no',
        drinking: 'no',
        kundliMatch: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '88888888-8888-8888-8888-888888888888',
        userId: '22222222-2222-2222-2222-222222222222',
        ageMin: 25,
        ageMax: 32,
        heightMin: 155,
        heightMax: 170,
        religion: 'any',
        caste: 'any',
        education: 'any',
        profession: 'any',
        incomeMin: 400000,
        incomeMax: 1000000,
        city: 'any',
        diet: 'any',
        smoking: 'no',
        drinking: 'any',
        kundliMatch: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '99999999-9999-9999-9999-999999999999',
        userId: '33333333-3333-3333-3333-333333333333',
        ageMin: 30,
        ageMax: 38,
        heightMin: 170,
        heightMax: 185,
        religion: 'Hindu',
        caste: 'any',
        education: 'Post Graduate',
        profession: 'any',
        incomeMin: 800000,
        incomeMax: 2000000,
        city: 'any',
        diet: 'vegetarian',
        smoking: 'no',
        drinking: 'no',
        kundliMatch: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    await queryInterface.bulkInsert('Preferences', samplePreferences);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Preferences', {
      userId: {
        [Sequelize.Op.in]: [
          '11111111-1111-1111-1111-111111111111',
          '22222222-2222-2222-2222-222222222222',
          '33333333-3333-3333-3333-333333333333'
        ]
      }
    });
    await queryInterface.bulkDelete('Profiles', {
      userId: {
        [Sequelize.Op.in]: [
          '11111111-1111-1111-1111-111111111111',
          '22222222-2222-2222-2222-222222222222',
          '33333333-3333-3333-3333-333333333333'
        ]
      }
    });
    await queryInterface.bulkDelete('Users', {
      id: {
        [Sequelize.Op.in]: [
          '11111111-1111-1111-1111-111111111111',
          '22222222-2222-2222-2222-222222222222',
          '33333333-3333-3333-3333-333333333333'
        ]
      }
    });
  }
};
