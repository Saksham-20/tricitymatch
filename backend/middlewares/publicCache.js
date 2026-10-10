/**
 * Cache-Control for anonymous JSON that is identical for every caller.
 *
 * Without it every landing visit sent /subscription/plans and /success-stories
 * to the origin. With it the browser and Cloudflare (via a cache rule on these
 * paths) reuse one answer for up to `seconds`. Only for handlers that never read
 * req.user, a cookie or anything else per caller.
 */
const publicCache = (seconds) => function publicCacheHeader(req, res, next) {
  res.set('Cache-Control', `public, max-age=${seconds}, s-maxage=${seconds}`);
  next();
};

module.exports = { publicCache };
