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
const MarketingPayout = require('./MarketingPayout');
const CallSession = require('./CallSession');
const GuardianLink = require('./GuardianLink');
const Astrologer = require('./Astrologer');
const AstrologerBooking = require('./AstrologerBooking');
const SuccessStory = require('./SuccessStory');
const Group = require('./Group');
const GroupMember = require('./GroupMember');
const GroupMessage = require('./GroupMessage');
const ContactMessage = require('./ContactMessage');
const AppSetting = require('./AppSetting');
const UnlockPurchase = require('./UnlockPurchase');
const AnalyticsEvent = require('./AnalyticsEvent');
const ChatGrant = require('./ChatGrant');
const AuditLog = require('./AuditLog');

// Define Relationships
User.hasOne(Profile, { foreignKey: 'userId', onDelete: 'CASCADE' });
Profile.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Subscription, { foreignKey: 'userId', onDelete: 'CASCADE' });
Subscription.belongsTo(User, { foreignKey: 'userId' });

AuditLog.belongsTo(User, { foreignKey: 'actorId', as: 'Actor' });
AuditLog.belongsTo(User, { foreignKey: 'targetUserId', as: 'TargetUser' });
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
// D2 quote-reply: self-FK, ON DELETE SET NULL (deleting the quoted message
// degrades the quote, never cascades the reply away).
Message.belongsTo(Message, { foreignKey: 'replyToId', as: 'ReplyTo' });

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

// ChatGrant relationships (D1 free-reply window)
User.hasMany(ChatGrant, { foreignKey: 'premiumUserId', as: 'GrantsGiven', onDelete: 'CASCADE' });
User.hasMany(ChatGrant, { foreignKey: 'freeUserId', as: 'GrantsHeld', onDelete: 'CASCADE' });
ChatGrant.belongsTo(User, { foreignKey: 'premiumUserId', as: 'PremiumUser' });
ChatGrant.belongsTo(User, { foreignKey: 'freeUserId', as: 'FreeUser' });

// ReferralCode relationships
User.hasMany(ReferralCode, { foreignKey: 'marketingUserId', onDelete: 'CASCADE' });
ReferralCode.belongsTo(User, { foreignKey: 'marketingUserId', as: 'MarketingUser' });

// MarketingLead relationships
User.hasMany(MarketingLead, { foreignKey: 'assignedToMarketingUserId', as: 'MarketingLeads', onDelete: 'CASCADE' });
User.hasMany(MarketingLead, { foreignKey: 'convertedUserId', as: 'ConvertedFrom' });
MarketingLead.belongsTo(User, { foreignKey: 'assignedToMarketingUserId', as: 'AssignedMarketer' });
MarketingLead.belongsTo(User, { foreignKey: 'convertedUserId', as: 'ConvertedUser' });

// MarketingPayout relationships
User.hasMany(MarketingPayout, { foreignKey: 'marketingUserId', as: 'MarketingPayouts', onDelete: 'CASCADE' });
MarketingPayout.belongsTo(User, { foreignKey: 'marketingUserId', as: 'MarketingUser' });
MarketingPayout.belongsTo(User, { foreignKey: 'createdBy', as: 'RecordedBy' });

// CallSession relationships
User.hasMany(CallSession, { foreignKey: 'callerId', as: 'CallsMade', onDelete: 'CASCADE' });
User.hasMany(CallSession, { foreignKey: 'calleeId', as: 'CallsReceived', onDelete: 'CASCADE' });
CallSession.belongsTo(User, { foreignKey: 'callerId', as: 'Caller' });
CallSession.belongsTo(User, { foreignKey: 'calleeId', as: 'Callee' });

// GuardianLink relationships
User.hasMany(GuardianLink, { foreignKey: 'candidateId', as: 'GuardiansInvited', onDelete: 'CASCADE' });
User.hasMany(GuardianLink, { foreignKey: 'guardianId', as: 'GuardianOf', onDelete: 'CASCADE' });
GuardianLink.belongsTo(User, { foreignKey: 'candidateId', as: 'Candidate' });
GuardianLink.belongsTo(User, { foreignKey: 'guardianId', as: 'Guardian' });

// Astrologer + Booking relationships
Astrologer.hasMany(AstrologerBooking, { foreignKey: 'astrologerId', as: 'Bookings', onDelete: 'CASCADE' });
AstrologerBooking.belongsTo(Astrologer, { foreignKey: 'astrologerId', as: 'Astrologer' });
User.hasMany(AstrologerBooking, { foreignKey: 'userId', as: 'AstrologerBookings', onDelete: 'CASCADE' });
AstrologerBooking.belongsTo(User, { foreignKey: 'userId', as: 'User' });

// Family Group relationships
User.hasMany(Group, { foreignKey: 'createdBy', as: 'GroupsCreated', onDelete: 'CASCADE' });
Group.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
Group.belongsTo(User, { foreignKey: 'candidateUserId', as: 'Candidate' });

Group.hasMany(GroupMember, { foreignKey: 'groupId', as: 'Members', onDelete: 'CASCADE' });
GroupMember.belongsTo(Group, { foreignKey: 'groupId', as: 'Group' });
User.hasMany(GroupMember, { foreignKey: 'userId', as: 'GroupMemberships', onDelete: 'CASCADE' });
GroupMember.belongsTo(User, { foreignKey: 'userId', as: 'User' });

Group.hasMany(GroupMessage, { foreignKey: 'groupId', as: 'GroupMessages', onDelete: 'CASCADE' });
GroupMessage.belongsTo(Group, { foreignKey: 'groupId', as: 'Group' });
User.hasMany(GroupMessage, { foreignKey: 'senderId', as: 'GroupMessagesSent', onDelete: 'CASCADE' });
GroupMessage.belongsTo(User, { foreignKey: 'senderId', as: 'Sender' });

// Unlock top-up purchases
User.hasMany(UnlockPurchase, { foreignKey: 'userId', as: 'UnlockPurchases', onDelete: 'CASCADE' });
UnlockPurchase.belongsTo(User, { foreignKey: 'userId' });

// Funnel events. No User.hasMany: the two pre-account counters carry userId NULL,
// so events are not a child collection of a user. CASCADE lives on the FK.
AnalyticsEvent.belongsTo(User, { foreignKey: 'userId' });

// Member invites (Phase S). Self-referencing: `invitedBy` points at the member
// whose invite link was used. ON DELETE SET NULL lives on the FK (migration
// 000048) — deleting an inviter orphans the edge, it never cascades away the
// invitee's account.
User.belongsTo(User, { foreignKey: 'invitedBy', as: 'Inviter' });
User.hasMany(User, { foreignKey: 'invitedBy', as: 'InvitedUsers' });

module.exports = {
  sequelize,
  User,
  Profile,
  Subscription,
  Match,
  Message,
  Verification,
  AuditLog,
  ProfileView,
  RefreshToken,
  Block,
  Report,
  Notification,
  ContactUnlock,
  ReferralCode,
  MarketingLead,
  MarketingPayout,
  CallSession,
  GuardianLink,
  Astrologer,
  AstrologerBooking,
  SuccessStory,
  Group,
  GroupMember,
  GroupMessage,
  ContactMessage,
  AppSetting,
  UnlockPurchase,
  AnalyticsEvent,
  ChatGrant,
};

