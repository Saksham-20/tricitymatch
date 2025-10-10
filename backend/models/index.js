const { sequelize } = require('../config/sequelize');

// Import all models
const User = require('./User');
const Profile = require('./Profile');
const Preference = require('./Preference');
const Like = require('./Like');
const Shortlist = require('./Shortlist');
const Chat = require('./Chat');
const Payment = require('./Payment');
const Report = require('./Report');
const ProfileView = require('./ProfileView');
const Notification = require('./Notification');
const ProfileBoost = require('./ProfileBoost');

// Define associations

// User associations
User.hasOne(Profile, { foreignKey: 'userId', as: 'profile' });
User.hasOne(Preference, { foreignKey: 'userId', as: 'preference' });
User.hasMany(Like, { foreignKey: 'userId', as: 'likes' });
User.hasMany(Like, { foreignKey: 'likedUserId', as: 'likedBy' });
User.hasMany(Shortlist, { foreignKey: 'userId', as: 'shortlists' });
User.hasMany(Shortlist, { foreignKey: 'shortlistedUserId', as: 'shortlistedBy' });
User.hasMany(Chat, { foreignKey: 'senderId', as: 'sentMessages' });
User.hasMany(Chat, { foreignKey: 'receiverId', as: 'receivedMessages' });
User.hasMany(Payment, { foreignKey: 'userId', as: 'payments' });
User.hasMany(Report, { foreignKey: 'reporterId', as: 'reportsMade' });
User.hasMany(Report, { foreignKey: 'reportedUserId', as: 'reportsReceived' });
User.hasMany(Report, { foreignKey: 'resolvedBy', as: 'resolvedReports' });
User.hasMany(ProfileView, { foreignKey: 'viewerId', as: 'profileViews' });
User.hasMany(ProfileView, { foreignKey: 'viewedUserId', as: 'profileViewedBy' });
User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });
User.hasMany(ProfileBoost, { foreignKey: 'userId', as: 'profileBoosts' });

// Profile associations
Profile.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Preference associations
Preference.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Like associations
Like.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Like.belongsTo(User, { foreignKey: 'likedUserId', as: 'likedUser' });

// Shortlist associations
Shortlist.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Shortlist.belongsTo(User, { foreignKey: 'shortlistedUserId', as: 'shortlistedUser' });

// Chat associations
Chat.belongsTo(User, { foreignKey: 'senderId', as: 'sender' });
Chat.belongsTo(User, { foreignKey: 'receiverId', as: 'receiver' });

// Payment associations
Payment.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Payment.hasMany(ProfileBoost, { foreignKey: 'paymentId', as: 'profileBoosts' });

// Report associations
Report.belongsTo(User, { foreignKey: 'reporterId', as: 'reporter' });
Report.belongsTo(User, { foreignKey: 'reportedUserId', as: 'reportedUser' });
Report.belongsTo(User, { foreignKey: 'resolvedBy', as: 'resolver' });

// ProfileView associations
ProfileView.belongsTo(User, { foreignKey: 'viewerId', as: 'viewer' });
ProfileView.belongsTo(User, { foreignKey: 'viewedUserId', as: 'viewedUser' });

// Notification associations
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// ProfileBoost associations
ProfileBoost.belongsTo(User, { foreignKey: 'userId', as: 'user' });
ProfileBoost.belongsTo(Payment, { foreignKey: 'paymentId', as: 'payment' });

// Export all models and sequelize instance
module.exports = {
  sequelize,
  User,
  Profile,
  Preference,
  Like,
  Shortlist,
  Chat,
  Payment,
  Report,
  ProfileView,
  Notification,
  ProfileBoost
};
