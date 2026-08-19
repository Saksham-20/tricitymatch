/**
 * Community stats — honest social-proof figures for the dashboards
 * ("12 new profiles this week"). Counts only ACTIVE, visible profiles so the
 * number matches what a member could actually find in Search; cached for an
 * hour because it moves slowly and this renders on every Home load.
 */
const { Op } = require('sequelize');
const { Profile, User } = require('../models');
const { asyncHandler } = require('../middlewares/errorHandler');
const cache = require('../utils/cache');

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_KEY = 'stats:community:v1';
const CACHE_TTL_S = 60 * 60;

exports.getCommunityStats = asyncHandler(async (req, res) => {
  const stats = await cache.getOrSet(CACHE_KEY, async () => {
    const visibleWhere = {
      isActive: true,
      [Op.or]: [
        { profileVisibility: { [Op.is]: null } },
        { profileVisibility: { [Op.ne]: 'matches_only' } },
      ],
    };
    const activeUser = { model: User, attributes: [], where: { status: 'active' }, required: true };

    const [newThisWeek, totalMembers] = await Promise.all([
      Profile.count({
        where: { ...visibleWhere, createdAt: { [Op.gte]: new Date(Date.now() - WEEK_MS) } },
        include: [activeUser],
      }),
      Profile.count({ where: visibleWhere, include: [activeUser] }),
    ]);

    return { newThisWeek, totalMembers };
  }, CACHE_TTL_S);

  res.json({ success: true, stats });
});
