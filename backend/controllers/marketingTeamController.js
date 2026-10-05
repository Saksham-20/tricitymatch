'use strict';

const { asyncHandler, createError } = require('../middlewares/errorHandler');
const { getTeamOverview } = require('../utils/marketingTeam');

// Who may read the team view. A plain partner sees only their own numbers; a
// manager oversees the team; admins can always look.
const TEAM_VIEW_ROLES = ['marketing_manager', 'admin', 'super_admin'];

const requireTeamView = (req, res, next) => {
  if (!req.user || !TEAM_VIEW_ROLES.includes(req.user.role)) {
    return next(createError.forbidden('The team view is for marketing managers.'));
  }
  return next();
};

// @route   GET /api/marketing/team
// @desc    Every partner's funnel and commission, numbers only (no member
//          details, no payout details).
// @access  Private/Marketing manager (and admins)
const getTeam = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await getTeamOverview()) });
});

module.exports = { requireTeamView, getTeam, TEAM_VIEW_ROLES };
