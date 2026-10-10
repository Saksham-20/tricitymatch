/**
 * The memory health check must compare heap use with the heap LIMIT. Dividing by
 * heapTotal (the heap V8 has grown to so far) called an idle server unhealthy,
 * so any alert built on /monitoring/health/full would flap and be ignored.
 */

jest.mock('../../config/database', () => ({}));

const v8 = require('v8');
const { checkMemory, STATUS } = require('../../utils/healthCheck');

const MB = 1024 * 1024;

describe('checkMemory', () => {
  afterEach(() => jest.restoreAllMocks());

  const fake = ({ heapUsed, heapTotal, limit }) => {
    jest.spyOn(process, 'memoryUsage').mockReturnValue({
      heapUsed: heapUsed * MB, heapTotal: heapTotal * MB, rss: 120 * MB, external: 2 * MB, arrayBuffers: 0,
    });
    jest.spyOn(v8, 'getHeapStatistics').mockReturnValue({ heap_size_limit: limit * MB });
  };

  test('an idle process with a nearly-full young heap is healthy', () => {
    fake({ heapUsed: 60, heapTotal: 64, limit: 524 });
    const m = checkMemory();
    expect(m.status).toBe(STATUS.HEALTHY);
    expect(m.heapUsagePercent).toBe('11%');
    expect(m.heapLimit).toBe('524MB');
  });

  test('close to the heap limit is unhealthy', () => {
    fake({ heapUsed: 490, heapTotal: 500, limit: 524 });
    expect(checkMemory().status).toBe(STATUS.UNHEALTHY);
  });

  test('past three quarters of the limit is degraded', () => {
    fake({ heapUsed: 420, heapTotal: 450, limit: 524 });
    expect(checkMemory().status).toBe(STATUS.DEGRADED);
  });
});
