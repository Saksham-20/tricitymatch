const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/sequelize');

const Preference = sequelize.define('Preference', {
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
  ageMin: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 18,
      max: 80
    }
  },
  ageMax: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 18,
      max: 80
    }
  },
  heightMin: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 120,
      max: 220
    }
  },
  heightMax: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 120,
      max: 220
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
  education: {
    type: DataTypes.STRING,
    allowNull: true
  },
  profession: {
    type: DataTypes.STRING,
    allowNull: true
  },
  incomeMin: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 0
    }
  },
  incomeMax: {
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
  diet: {
    type: DataTypes.ENUM('vegetarian', 'non-vegetarian', 'vegan', 'jain', 'any'),
    allowNull: true
  },
  smoking: {
    type: DataTypes.ENUM('yes', 'no', 'occasionally', 'any'),
    allowNull: true
  },
  drinking: {
    type: DataTypes.ENUM('yes', 'no', 'occasionally', 'any'),
    allowNull: true
  },
  kundliMatch: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  timestamps: true
});

// Instance methods
Preference.prototype.isAgeMatch = function(age) {
  if (!this.ageMin && !this.ageMax) return true;
  if (this.ageMin && age < this.ageMin) return false;
  if (this.ageMax && age > this.ageMax) return false;
  return true;
};

Preference.prototype.isHeightMatch = function(height) {
  if (!this.heightMin && !this.heightMax) return true;
  if (this.heightMin && height < this.heightMin) return false;
  if (this.heightMax && height > this.heightMax) return false;
  return true;
};

Preference.prototype.isIncomeMatch = function(income) {
  if (!this.incomeMin && !this.incomeMax) return true;
  if (this.incomeMin && income < this.incomeMin) return false;
  if (this.incomeMax && income > this.incomeMax) return false;
  return true;
};

module.exports = Preference;
