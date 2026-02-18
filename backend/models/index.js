const sequelize = require('../config/database');
const User = require('./User');
const Profile = require('./Profile');
const Subscription = require('./Subscription');
const Match = require('./Match');
const Message = require('./Message');
const Verification = require('./Verification');
const ProfileView = require('./ProfileView');
const RefreshToken = require('./RefreshToken');

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

module.exports = {
  sequelize,
  User,
  Profile,
  Subscription,
  Match,
  Message,
  Verification,
  ProfileView,
  RefreshToken
};

