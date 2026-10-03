'use strict';

/**
 * A member can only be listed, viewed, or take part in interests, messages and
 * calls once their age can be checked: a stored date of birth and a gender.
 *
 * The marriageable-age rule (constants/marriageableAge) runs only when a date of
 * birth is supplied, and a mobile account is created with email + password alone
 * and fills the date of birth in onboarding. Until then the account has nothing
 * the age rule could judge, so it must not be reachable by, or able to reach,
 * other members. Everyone who finished onboarding has both fields (they are
 * collected in the first onboarding step and locked afterwards), so this changes
 * nothing for them.
 */

const { Op } = require('sequelize');

/** Sequelize where-fragment for Profile listing queries. */
const AGE_VERIFIABLE_WHERE = {
  dateOfBirth: { [Op.ne]: null },
  gender: { [Op.ne]: null },
};

/** @param {{ dateOfBirth?: any, gender?: any } | null | undefined} profile */
const hasVerifiableAge = (profile) => Boolean(profile && profile.dateOfBirth && profile.gender);

/**
 * Throws 403 PROFILE_INCOMPLETE unless `userId` has a date of birth and gender on
 * file. For actions a member performs toward another (message, call).
 */
const assertActorAgeVerifiable = async (userId) => {
  const { Profile } = require('../models');
  const { createError } = require('../middlewares/errorHandler');
  const profile = await Profile.findOne({ where: { userId }, attributes: ['dateOfBirth', 'gender'] });
  if (!hasVerifiableAge(profile)) {
    throw createError.forbidden(
      'Add your date of birth and gender to your profile before messaging or calling.',
      'PROFILE_INCOMPLETE'
    );
  }
};

module.exports = { AGE_VERIFIABLE_WHERE, hasVerifiableAge, assertActorAgeVerifiable };
