/**
 * Cache-Control for anonymous JSON that is identical for every caller.
 *
 * Without it every landing visit sent /subscription/plans and /success-stories
 * to the origin. With it the browser and Cloudflare (via a cache rule on these
 * paths) reuse one answer for up to `seconds`. Only for handlers that never read
 * req.user, a cookie or anything else per caller.
 *
 * Cloudflare ignores `Vary: Origin`, so a cached copy keeps the CORS headers of
 * the first request. Fine while the only browser caller is the same-origin SPA
 * (native apps do not enforce CORS); a browser client on another origin would
 * need these routes uncached or an Origin-aware cache key.
 */
const publicCache = (seconds) => function publicCacheHeader(req, res, next) {
  res.set('Cache-Control', `public, max-age=${seconds}, s-maxage=${seconds}`);
  next();
};

module.exports = { publicCache };
