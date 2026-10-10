/**
 * Public, caller-independent JSON carries a short shared-cache lifetime so the
 * browser and Cloudflare can absorb landing-page traffic. Nothing else may.
 */

const { publicCache } = require('../../middlewares/publicCache');

const routeHandlers = (router, method, path) => {
  const layer = router.stack.find((l) => l.route && l.route.path === path && l.route.methods[method]);
  return layer ? layer.route.stack.map((s) => s.name) : null;
};

describe('publicCache', () => {
  test('sets a public 60-second lifetime for browsers and shared caches', () => {
    const res = { set: jest.fn() };
    const next = jest.fn();
    publicCache(60)({}, res, next);
    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'public, max-age=60, s-maxage=60');
    expect(next).toHaveBeenCalled();
  });

  test('is wired on GET /subscription/plans and GET /success-stories only', () => {
    const subscriptionRoutes = require('../../routes/subscriptionRoutes');
    const apiRoutes = require('../../routes/index');
    expect(routeHandlers(subscriptionRoutes, 'get', '/plans')).toContain('publicCacheHeader');
    expect(routeHandlers(apiRoutes, 'get', '/success-stories')).toContain('publicCacheHeader');
    // A per-member route must never be marked shareable.
    expect(routeHandlers(subscriptionRoutes, 'get', '/my-subscription')).not.toContain('publicCacheHeader');
  });
});
