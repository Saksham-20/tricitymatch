const mockGetRedisClient = jest.fn();
jest.mock('../../utils/cache', () => ({ getRedisClient: (...a) => mockGetRedisClient(...a) }));
jest.mock('../../middlewares/logger', () => ({ log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const mockCreateAdapter = jest.fn(() => 'adapter');
jest.mock('@socket.io/redis-adapter', () => ({ createAdapter: (...a) => mockCreateAdapter(...a) }));

const load = (enabled) => {
  jest.resetModules();
  jest.doMock('../../config/env', () => ({ socket: { redisAdapter: enabled } }));
  return require('../../utils/socketAdapter');
};

describe('attachRedisAdapter', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('does nothing when disabled', () => {
    const io = { adapter: jest.fn() };
    expect(load(false).attachRedisAdapter(io)).toEqual({ attached: false, reason: 'disabled' });
    expect(io.adapter).not.toHaveBeenCalled();
  });

  it('falls back to the in-process adapter when Redis is unavailable', () => {
    mockGetRedisClient.mockReturnValue(null);
    const io = { adapter: jest.fn() };
    expect(load(true).attachRedisAdapter(io)).toEqual({ attached: false, reason: 'no_redis' });
    expect(io.adapter).not.toHaveBeenCalled();
  });

  it('attaches with dedicated pub and sub connections', () => {
    const dup = () => ({ on: jest.fn() });
    const client = { duplicate: jest.fn(dup) };
    mockGetRedisClient.mockReturnValue(client);
    const io = { adapter: jest.fn() };
    const out = load(true).attachRedisAdapter(io);
    expect(out.attached).toBe(true);
    expect(client.duplicate).toHaveBeenCalledTimes(2);
    expect(mockCreateAdapter).toHaveBeenCalledWith(out.pub, out.sub);
    expect(io.adapter).toHaveBeenCalledWith('adapter');
    expect(out.pub).not.toBe(out.sub);
  });
});
