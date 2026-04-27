const sequelize = require('../config/database');
const User = require('./User');
const Profile = require('./Profile');
const Subscription = require('./Subscription');
const Match = require('./Match');
const Message = require('./Message');
const Verification = require('./Verification');
const ProfileView = require('./ProfileView');
const RefreshToken = require('./RefreshToken');
const Block = require('./Block');
const Report = require('./Report');
const Notification = require('./Notification');
const ContactUnlock = require('./ContactUnlock');
const ReferralCode = require('./ReferralCode');
const MarketingLead = require('./MarketingLead');

// Define Relationships
User.hasOne(Profile, { foreignKey: 'userId', onDelete: 'CASCADE' });
Profile.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Subscription, { foreignKey: 'userId', onDelete: 'CASCADE' });
Subscription.belongsTo(User, { foreignKey: 'userId' });

User.hasOne(Verification, { foreignKey: 'userId', onDelete: 'CASCADE' });
Verification.belongsTo(User, { foreignKey: 'userId' });
Verification.belongsTo(User, { foreignKey: 'verifiedBy', as: 'Verifier' });

// Match relationships
User.hasMany(Match, { foreignKey: 'userId', as: 'Matches' });
User.hasMany(Match, { foreignKey: 'matchedUserId', as: 'MatchedBy' });
Match.belongsTo(User, { foreignKey: 'userId', as: 'User' });
Match.belongsTo(User, { foreignKey: 'matchedUserId', as: 'MatchedUser' });

// Message relationships
User.hasMany(Message, { foreignKey: 'senderId', as: 'SentMessages' });
User.hasMany(Message, { foreignKey: 'receiverId', as: 'ReceivedMessages' });
Message.belongsTo(User, { foreignKey: 'senderId', as: 'Sender' });
Message.belongsTo(User, { foreignKey: 'receiverId', as: 'Receiver' });

// ProfileView relationships
User.hasMany(ProfileView, { foreignKey: 'viewerId', as: 'ProfileViews' });
User.hasMany(ProfileView, { foreignKey: 'viewedUserId', as: 'ViewedBy' });
ProfileView.belongsTo(User, { foreignKey: 'viewerId', as: 'Viewer' });
ProfileView.belongsTo(User, { foreignKey: 'viewedUserId', as: 'ViewedUser' });

// RefreshToken relationships
User.hasMany(RefreshToken, { foreignKey: 'userId', onDelete: 'CASCADE' });
RefreshToken.belongsTo(User, { foreignKey: 'userId' });

// Block relationships
User.hasMany(Block, { foreignKey: 'blockerId', as: 'BlockedUsers', onDelete: 'CASCADE' });
User.hasMany(Block, { foreignKey: 'blockedUserId', as: 'BlockedBy', onDelete: 'CASCADE' });
Block.belongsTo(User, { foreignKey: 'blockerId', as: 'Blocker' });
Block.belongsTo(User, { foreignKey: 'blockedUserId', as: 'BlockedUser' });

// Report relationships
User.hasMany(Report, { foreignKey: 'reporterId', as: 'ReportsFiled', onDelete: 'CASCADE' });
User.hasMany(Report, { foreignKey: 'reportedUserId', as: 'ReportsReceived', onDelete: 'CASCADE' });
Report.belongsTo(User, { foreignKey: 'reporterId', as: 'Reporter' });
Report.belongsTo(User, { foreignKey: 'reportedUserId', as: 'ReportedUser' });
Report.belongsTo(User, { foreignKey: 'reviewedBy', as: 'Reviewer' });

// Notification relationships
User.hasMany(Notification, { foreignKey: 'userId', onDelete: 'CASCADE' });
Notification.belongsTo(User, { foreignKey: 'userId' });

// ContactUnlock relationships
User.hasMany(ContactUnlock, { foreignKey: 'userId', as: 'ContactUnlocks', onDelete: 'CASCADE' });
User.hasMany(ContactUnlock, { foreignKey: 'targetUserId', as: 'UnlockedBy', onDelete: 'CASCADE' });
ContactUnlock.belongsTo(User, { foreignKey: 'userId', as: 'Unlocker' });
ContactUnlock.belongsTo(User, { foreignKey: 'targetUserId', as: 'UnlockedUser' });

// ReferralCode relationships
User.hasMany(ReferralCode, { foreignKey: 'marketingUserId', onDelete: 'CASCADE' });
ReferralCode.belongsTo(User, { foreignKey: 'marketingUserId', as: 'MarketingUser' });

// MarketingLead relationships
User.hasMany(MarketingLead, { foreignKey: 'assignedToMarketingUserId', as: 'MarketingLeads', onDelete: 'CASCADE' });
User.hasMany(MarketingLead, { foreignKey: 'convertedUserId', as: 'ConvertedFrom' });
MarketingLead.belongsTo(User, { foreignKey: 'assignedToMarketingUserId', as: 'AssignedMarketer' });
MarketingLead.belongsTo(User, { foreignKey: 'convertedUserId', as: 'ConvertedUser' });

module.exports = {
  sequelize,
  User,
  Profile,
  Subscription,
  Match,
  Message,
  Verification,
  ProfileView,
  RefreshToken,
  Block,
  Report,
  Notification,
  ContactUnlock,
  ReferralCode,
  MarketingLead,
};

