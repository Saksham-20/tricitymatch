'use strict';
const bcrypt = require('bcryptjs');

module.exports = {
  async up(queryInterface, Sequelize) {
    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 12);
    
    const adminUser = await queryInterface.bulkInsert('Users', [{
      id: '00000000-0000-0000-0000-000000000001',
      email: 'admin@tricitymatch.com',
      password: adminPassword,
      phone: '+919876543210',
      role: 'admin',
      isVerified: true,
      isEmailVerified: true,
      subscriptionType: 'elite',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }], { returning: true });

    // Create admin profile
    await queryInterface.bulkInsert('Profiles', [{
      id: '00000000-0000-0000-0000-000000000002',
      userId: '00000000-0000-0000-0000-000000000001',
      name: 'Admin User',
      gender: 'male',
      dob: '1990-01-01',
      height: 175,
      weight: 70,
      religion: 'Hindu',
      caste: 'General',
      city: 'Chandigarh',
      education: 'Post Graduate',
      profession: 'Software Engineer',
      income: 1000000,
      bio: 'Administrator of Tricity Match platform',
      photos: JSON.stringify([{
        id: '1',
        url: '/uploads/defaults/admin-avatar.jpg',
        isPrimary: true,
        uploadedAt: new Date().toISOString()
      }]),
      personalityAnswers: JSON.stringify({
        values: 'family',
        lifestyle: 'balanced',
        hobbies: 'technology, management'
      }),
      verificationStatus: 'verified',
      verificationDocs: JSON.stringify({}),
      isProfileComplete: true,
      profileCompletionPercentage: 100,
      createdAt: new Date(),
      updatedAt: new Date()
    }]);

    // Create admin preferences
    await queryInterface.bulkInsert('Preferences', [{
      id: '00000000-0000-0000-0000-000000000003',
      userId: '00000000-0000-0000-0000-000000000001',
      ageMin: 25,
      ageMax: 35,
      heightMin: 150,
      heightMax: 180,
      religion: 'any',
      education: 'any',
      profession: 'any',
      city: 'any',
      diet: 'any',
      smoking: 'any',
      drinking: 'any',
      kundliMatch: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Preferences', { userId: '00000000-0000-0000-0000-000000000001' });
    await queryInterface.bulkDelete('Profiles', { userId: '00000000-0000-0000-0000-000000000001' });
    await queryInterface.bulkDelete('Users', { id: '00000000-0000-0000-0000-000000000001' });
  }
};
