const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/sequelize');

const Profile = sequelize.define('Profile', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [2, 50]
    }
  },
  gender: {
    type: DataTypes.ENUM('male', 'female', 'other'),
    allowNull: false
  },
  dob: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  height: {
    type: DataTypes.INTEGER, // in cm
    allowNull: true,
    validate: {
      min: 120,
      max: 220
    }
  },
  weight: {
    type: DataTypes.INTEGER, // in kg
    allowNull: true,
    validate: {
      min: 30,
      max: 200
    }
  },
  religion: {
    type: DataTypes.STRING,
    allowNull: true
  },
  caste: {
    type: DataTypes.STRING,
    allowNull: true
  },
  community: {
    type: DataTypes.STRING,
    allowNull: true
  },
  skinTone: {
    type: DataTypes.ENUM('fair', 'wheatish', 'dark', 'very fair'),
    allowNull: true
  },
  diet: {
    type: DataTypes.ENUM('vegetarian', 'non-vegetarian', 'vegan', 'jain'),
    allowNull: true
  },
  smoking: {
    type: DataTypes.ENUM('yes', 'no', 'occasionally'),
    allowNull: true
  },
  drinking: {
    type: DataTypes.ENUM('yes', 'no', 'occasionally'),
    allowNull: true
  },
  education: {
    type: DataTypes.STRING,
    allowNull: true
  },
  profession: {
    type: DataTypes.STRING,
    allowNull: true
  },
  income: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 0
    }
  },
  city: {
    type: DataTypes.STRING,
    allowNull: true
  },
  bio: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: [0, 500]
    }
  },
  photos: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  personalityAnswers: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  verificationStatus: {
    type: DataTypes.ENUM('pending', 'verified', 'rejected'),
    defaultValue: 'pending'
  },
  verificationDocs: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  birthTime: {
    type: DataTypes.TIME,
    allowNull: true
  },
  birthPlace: {
    type: DataTypes.STRING,
    allowNull: true
  },
  kundliData: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  isProfileComplete: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  profileCompletionPercentage: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0,
      max: 100
    }
  }
}, {
  timestamps: true
});

// Instance methods
Profile.prototype.calculateAge = function() {
  const today = new Date();
  const birthDate = new Date(this.dob);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};

Profile.prototype.calculateCompletionPercentage = function() {
  const fields = [
    'name', 'gender', 'dob', 'height', 'religion', 'education', 
    'profession', 'city', 'bio', 'photos'
  ];
  
  let completedFields = 0;
  fields.forEach(field => {
    if (this[field] && (Array.isArray(this[field]) ? this[field].length > 0 : true)) {
      completedFields++;
    }
  });
  
  return Math.round((completedFields / fields.length) * 100);
};

Profile.prototype.updateCompletionStatus = function() {
  const percentage = this.calculateCompletionPercentage();
  this.profileCompletionPercentage = percentage;
  this.isProfileComplete = percentage >= 80;
  return this.save();
};

module.exports = Profile;
