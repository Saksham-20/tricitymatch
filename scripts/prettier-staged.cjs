/**
 * Run Prettier only on existing files (avoids ENOENT when files are deleted/stashed).
 * Lint-staged passes the list of files as arguments.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const files = process.argv.slice(2).filter((p) => {
  const full = path.isAbsolute(p) ? p : path.join(root, p);
  return fs.existsSync(full);
});

if (files.length === 0) process.exit(0);

const result = spawnSync('npx', ['prettier', '--write', ...files], {
  stdio: 'inherit',
  cwd: root,
  shell: true,
});
process.exit(result.status || 0);
