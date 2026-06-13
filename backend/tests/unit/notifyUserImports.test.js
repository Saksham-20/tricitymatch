/**
 * Regression test: notifyUser must be imported via destructuring.
 *
 * utils/notifyUser.js exports `{ notify }`, not a bare function. Importing it
 * with `const notify = require('../utils/notifyUser')` makes `notify` an
 * object (`{ notify: fn }`), so any later call to `notify(...)` throws
 * "TypeError: notify is not a function" at runtime.
 *
 * This previously broke: profile completion milestones, guardian invite
 * linking, astrologer booking payment confirmation, selfie/background-check
 * notifications, and the saved-search-alerts cron job.
 */

const fs = require('fs');
const path = require('path');

const FILES_USING_NOTIFY = [
  'controllers/profileController.js',
  'controllers/matchController.js',
  'controllers/adminController.js',
  'controllers/subscriptionController.js',
  'controllers/callController.js',
  'routes/guardianRoutes.js',
  'routes/astrologerRoutes.js',
  'routes/verificationRoutes.js',
  'utils/queue.js',
];

describe('notifyUser import shape', () => {
  it('exports an object with a notify function (not a bare function)', () => {
    const notifyUser = require('../../utils/notifyUser');
    expect(typeof notifyUser).toBe('object');
    expect(typeof notifyUser.notify).toBe('function');
  });

  it.each(FILES_USING_NOTIFY)('%s destructures { notify } from notifyUser', (relPath) => {
    const source = fs.readFileSync(path.join(__dirname, '../../', relPath), 'utf8');
    const requireLines = source
      .split('\n')
      .filter((line) => /require\(['"].*notifyUser['"]\)/.test(line));

    expect(requireLines.length).toBeGreaterThan(0);
    for (const line of requireLines) {
      expect(line).toMatch(/const\s*\{\s*notify\s*\}\s*=\s*require/);
    }
  });
});
