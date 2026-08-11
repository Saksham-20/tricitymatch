/**
 * Regression test: notifyUser must be imported via destructuring.
 *
 * utils/notifyUser.js exports `{ notify }`, not a bare function. Importing it
 * with `const notify = require('../utils/notifyUser')` makes `notify` an
 * object (`{ notify: fn }`), so any later call to `notify(...)` throws
 * "TypeError: notify is not a function" at runtime.
 *
 * This previously broke: profile completion milestones, guardian invite
 * linking, astrologer booking payment confirmation, verification
 * notifications, and the saved-search-alerts cron job.
 *
 * The consumer list is DISCOVERED, not hardcoded. A hardcoded list fails for
 * the wrong reason when a route is legitimately retired (it did, when the dead
 * selfie-liveness route was removed) and stays silent when a new caller is
 * added with the broken import — which is the bug this test exists to catch.
 */

const fs = require('fs');
const path = require('path');

const BACKEND_ROOT = path.join(__dirname, '../../');
const SEARCH_DIRS = ['controllers', 'routes', 'utils', 'middlewares', 'socket', 'services'];
const REQUIRES_NOTIFY_USER = /require\(['"].*notifyUser['"]\)/;

const walk = (dir, out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
};

const consumers = SEARCH_DIRS
  .flatMap((d) => walk(path.join(BACKEND_ROOT, d)))
  .filter((f) => path.relative(BACKEND_ROOT, f) !== 'utils/notifyUser.js')
  .filter((f) => REQUIRES_NOTIFY_USER.test(fs.readFileSync(f, 'utf8')))
  .map((f) => path.relative(BACKEND_ROOT, f));

describe('notifyUser import shape', () => {
  it('exports an object with a notify function (not a bare function)', () => {
    const notifyUser = require('../../utils/notifyUser');
    expect(typeof notifyUser).toBe('object');
    expect(typeof notifyUser.notify).toBe('function');
  });

  it('finds the notifyUser consumers to check', () => {
    // If the walk breaks, every it.each below would vacuously pass.
    expect(consumers.length).toBeGreaterThan(0);
  });

  it.each(consumers)('%s destructures { notify } from notifyUser', (relPath) => {
    const source = fs.readFileSync(path.join(BACKEND_ROOT, relPath), 'utf8');
    const requireLines = source
      .split('\n')
      .filter((line) => REQUIRES_NOTIFY_USER.test(line));

    expect(requireLines.length).toBeGreaterThan(0);
    for (const line of requireLines) {
      expect(line).toMatch(/const\s*\{\s*notify\s*\}\s*=\s*require/);
    }
  });
});
