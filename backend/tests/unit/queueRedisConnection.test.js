/**
 * P1-2: job queues connect to the dedicated non-evicting Redis when configured,
 * and to the main Redis otherwise.
 */
const fs = require('fs');
const path = require('path');

const load = (redis) => {
  jest.resetModules();
  jest.doMock('../../config/env', () => ({ redis, isDevelopment: false }));
  jest.doMock('../../middlewares/logger', () => ({ log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
  return require('../../utils/queue');
};

describe('queueRedisConnection', () => {
  it('uses the dedicated queue instance when QUEUE_REDIS_* resolve to one', () => {
    const { queueRedisConnection } = load({
      host: 'redis', port: 6379, password: 'cachepw', url: '',
      queue: { url: '', host: 'redis-queue', port: 6379, password: 'qpw' },
    });
    expect(queueRedisConnection()).toEqual({ host: 'redis-queue', port: 6379, password: 'qpw' });
  });

  it('falls back to the main instance when no queue instance is set', () => {
    const { queueRedisConnection } = load({
      host: 'redis', port: 6379, password: 'cachepw', url: '',
      queue: { url: '', host: 'redis', port: 6379, password: 'cachepw' },
    });
    expect(queueRedisConnection()).toEqual({ host: 'redis', port: 6379, password: 'cachepw' });
  });

  it('honours a queue URL over host/port', () => {
    const { queueRedisConnection } = load({
      host: 'redis', port: 6379, password: '', url: '',
      queue: { url: 'redis://q:6379', host: 'redis', port: 6379, password: '' },
    });
    expect(queueRedisConnection()).toBe('redis://q:6379');
  });
});

describe('compose Redis split', () => {
  const compose = fs.readFileSync(path.join(__dirname, '../../../docker-compose.yml'), 'utf8');
  it('queue instance never evicts, cache instance evicts only expiring keys', () => {
    expect(compose).toMatch(/redis-queue:[\s\S]*?--maxmemory-policy noeviction/);
    expect(compose).toMatch(/--maxmemory-policy volatile-lru/);
    expect(compose).not.toMatch(/allkeys-lru/);
  });
  it('backend is pointed at the queue instance', () => {
    expect(compose).toMatch(/QUEUE_REDIS_HOST: redis-queue/);
  });
});
