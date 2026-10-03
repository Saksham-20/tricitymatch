const { createShutdown } = require('../../utils/shutdown');

const quiet = { log: () => {}, error: () => {} };

const make = (over = {}) => {
  const order = [];
  const server = { listening: true, close: jest.fn((cb) => { order.push('server'); cb(); }), closeIdleConnections: jest.fn() };
  const io = { close: jest.fn((cb) => { order.push('io'); cb(); }) };
  const deps = {
    server, io, logger: quiet,
    closeQueues: jest.fn(async () => { order.push('queues'); }),
    closeCache: jest.fn(async () => { order.push('cache'); }),
    sequelize: { close: jest.fn(async () => { order.push('db'); }) },
    exit: jest.fn(),
    ...over,
  };
  return { deps, order, run: createShutdown(deps) };
};

describe('graceful shutdown (SITE-12)', () => {
  it('closes sockets BEFORE the http server, then queues, cache, database, and exits 0', async () => {
    const { deps, order, run } = make();
    await run('SIGTERM');
    expect(order).toEqual(['io', 'server', 'queues', 'cache', 'db']);
    expect(deps.exit).toHaveBeenCalledWith(0);
  });

  it('does not wait on server.close when sockets keep it open: io.close comes first', async () => {
    // server.close never calls back until io has closed (the production shape)
    let ioClosed = false;
    const { deps, run } = make();
    deps.io.close = jest.fn((cb) => { ioClosed = true; cb(); });
    deps.server.close = jest.fn((cb) => { if (ioClosed) cb(); });
    await run('SIGTERM');
    expect(deps.exit).toHaveBeenCalledWith(0);
  });

  it('keeps going when one resource fails to close', async () => {
    const { deps, run } = make({ closeCache: jest.fn(async () => { throw new Error('redis gone'); }) });
    await run('SIGINT');
    expect(deps.sequelize.close).toHaveBeenCalled();
    expect(deps.exit).toHaveBeenCalledWith(0);
  });

  it('runs once: a second signal or a crash during shutdown is ignored', async () => {
    const { deps, run } = make();
    await Promise.all([run('SIGTERM'), run('uncaughtException', { exitCode: 1 })]);
    expect(deps.sequelize.close).toHaveBeenCalledTimes(1);
    expect(deps.exit).toHaveBeenCalledTimes(1);
  });

  it('exits with the code it was given (crash path)', async () => {
    const { deps, run } = make();
    await run('uncaughtException', { exitCode: 1 });
    expect(deps.exit).toHaveBeenCalledWith(1);
  });

  it('forces exit(1) if something hangs past the deadline', async () => {
    jest.useFakeTimers();
    const hang = new Promise(() => {});
    const { deps, run } = make({ forceExitMs: 50, closeQueues: jest.fn(() => hang) });
    run('SIGTERM');
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    jest.advanceTimersByTime(60);
    expect(deps.exit).toHaveBeenCalledWith(1);
    jest.useRealTimers();
  });
});
