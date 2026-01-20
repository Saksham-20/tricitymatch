const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Profile = sequelize.define('Profile', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  // Basic Info
  firstName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  gender: {
    type: DataTypes.ENUM('male', 'female', 'other'),
    allowNull: true,
    defaultValue: 'other'
  },
  dateOfBirth: {
    type: DataTypes.DATE,
    allowNull: true
  },
  height: {
    type: DataTypes.INTEGER, // in cm
    allowNull: true
  },
  weight: {
    type: DataTypes.INTEGER, // in kg
    allowNull: true
  },
  // Location
  city: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Chandigarh'
  },
  state: {
    type: DataTypes.STRING,
    defaultValue: 'Punjab'
  },
  // Lifestyle
  skinTone: {
    type: DataTypes.ENUM('fair', 'wheatish', 'dark'),
    allowNull: true
  },
  diet: {
    type: DataTypes.ENUM('vegetarian', 'non-vegetarian', 'vegan', 'jain'),
    allowNull: true
  },
  smoking: {
    type: DataTypes.ENUM('never', 'occasionally', 'regularly'),
    allowNull: true
  },
  drinking: {
    type: DataTypes.ENUM('never', 'occasionally', 'regularly'),
    allowNull: true
  },
  // Education & Profession
  education: {
    type: DataTypes.STRING,
    allowNull: true
  },
  degree: {
    type: DataTypes.STRING,
    allowNull: true
  },
  profession: {
    type: DataTypes.STRING,
    allowNull: true
  },
  income: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  // Preferences
  preferredAgeMin: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  preferredAgeMax: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  preferredHeightMin: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  preferredHeightMax: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  preferredEducation: {
    type: DataTypes.STRING,
    allowNull: true
  },
  preferredProfession: {
    type: DataTypes.STRING,
    allowNull: true
  },
  preferredCity: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: ['Chandigarh', 'Mohali', 'Panchkula']
  },
  // Personality Questions (for compatibility)
  personalityValues: {
    type: DataTypes.JSONB,
    allowNull: true // e.g., { familyOriented: true, careerFocused: false, traditional: true }
  },
  familyPreferences: {
    type: DataTypes.JSONB,
    allowNull: true // e.g., { jointFamily: true, children: 2 }
  },
  lifestylePreferences: {
    type: DataTypes.JSONB,
    allowNull: true // e.g., { travel: true, hobbies: ['reading', 'music'] }
  },
  // Photos
  photos: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },
  profilePhoto: {
    type: DataTypes.STRING,
    allowNull: true
  },
  // Profile Status
  completionPercentage: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  bio: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Privacy Settings
  showPhone: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  showEmail: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  // Enhanced Features
  interestTags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },
  profilePrompts: {
    type: DataTypes.JSONB,
    allowNull: true // Hinge-style prompts: { prompt1: "I'm looking for...", answer1: "...", ... }
  },
  spotifyPlaylist: {
    type: DataTypes.STRING,
    allowNull: true
  },
  socialMediaLinks: {
    type: DataTypes.JSONB,
    allowNull: true // { instagram: "url", linkedin: "url", facebook: "url", twitter: "url" }
  },
  personalityType: {
    type: DataTypes.STRING,
    allowNull: true // MBTI, Enneagram, etc.
  },
  languages: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },
  incognitoMode: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  photoBlurUntilMatch: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  indexes: [
    // Frequently filtered in search queries
    { fields: ['city'] },
    { fields: ['gender'] },
    { fields: ['isActive'] },
    // Composite index for common search pattern
    { fields: ['isActive', 'gender', 'city'] },
    // For age-based filtering (calculated from dateOfBirth)
    { fields: ['dateOfBirth'] }
  ]
});

module.exports = Profile;

