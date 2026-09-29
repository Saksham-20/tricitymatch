'use strict';

/**
 * Walk EVERY matching user in pages, ordered by id (keyset pagination).
 *
 * The weekly digest and the saved-search alerts used to `findAll({ limit: 500 })`
 * with no ordering or offset, so once there were more users than the limit the
 * same head of the table was served every run and everyone after it never was.
 */

const { Op } = require('sequelize');

/**
 * @param {object} User             the model
 * @param {object} query            findAll options (where, include, attributes)
 * @param {(users: object[]) => Promise<void>} handler
 * @param {number} [pageSize]
 * @returns {Promise<number>}       users visited
 */
const forEachUserPage = async (User, query, handler, pageSize = 500) => {
  let lastId = null;
  let total = 0;
  for (;;) {
    const users = await User.findAll({
      ...query,
      where: { ...(query.where || {}), ...(lastId ? { id: { [Op.gt]: lastId } } : {}) },
      order: [['id', 'ASC']],
      limit: pageSize,
    });
    if (users.length === 0) break;
    total += users.length;
    lastId = users[users.length - 1].id;
    await handler(users);
    if (users.length < pageSize) break;
  }
  return total;
};

module.exports = { forEachUserPage };
