/**
 * verify-payment and cancel-order must not share the create-order budget:
 * two abandoned checkouts used to cost four of the ten hourly hits and left no
 * budget to confirm the attempt that finally succeeded.
 */

jest.mock('../../models', () => ({}));
jest.mock('../../controllers/subscriptionController', () => new Proxy({}, { get: () => (req, res, next) => next() }));

describe('subscription route rate limiters', () => {
  const router = require('../../routes/subscriptionRoutes');
  const handlesFor = (path) => router.stack.find((l) => l.route && l.route.path === path).route.stack.map((s) => s.handle);

  it('create-order keeps its own tight limiter; verify-payment and cancel-order use a different one', () => {
    const create = handlesFor('/create-order')[1];
    const verify = handlesFor('/verify-payment')[1];
    const cancel = handlesFor('/cancel-order')[1];
    expect(verify).not.toBe(create);
    expect(cancel).not.toBe(create);
    expect(cancel).toBe(verify);
  });

  it('bundle verification is off the order-minting budget too', () => {
    const create = handlesFor('/create-order')[1];
    expect(handlesFor('/unlock-bundle/verify-payment')[1]).not.toBe(create);
    expect(handlesFor('/unlock-bundle/create-order')[1]).toBe(create);
  });
});
