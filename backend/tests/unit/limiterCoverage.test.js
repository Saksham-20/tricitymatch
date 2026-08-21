/**
 * Rate-limiter coverage on the routes that need more than the global ceiling
 * (deep security audit 2026-08-21, R2 REGRESSION-1 / DoS-3).
 *
 * Everything under /api sits behind apiLimiter (200 per 15 minutes per address).
 * That is a backstop, not a budget: it still permits 200 PDF renders, 200
 * invite-token guesses or 200 full Ashtakoot computations in a quarter hour
 * from a single client.
 *
 * The specific failure this pins is subtler than a missing limiter. Round 1
 * added `sensitiveActionLimiter` to guardianRoutes' import list and added the
 * guardian invite path to the log-redaction prefixes — but never applied the
 * limiter to the route. The import sat unused, the diff looked done, and the
 * 32-byte bearer token in the URL was still guessable at the global rate. An
 * imported-but-unapplied middleware is invisible to every test that only checks
 * behaviour through a mocked chain, so this asserts on the wiring itself.
 */

const fs = require('fs');
const path = require('path');

const routeSrc = (file) =>
  fs.readFileSync(path.join(__dirname, '..', '..', 'routes', file), 'utf8');

/**
 * Pull the middleware list for one route definition, counting parentheses so a
 * multi-line definition is captured whole.
 */
const routeChain = (source, method, routePath) => {
  const opener = `router.${method}(`;
  let from = 0;
  for (;;) {
    const start = source.indexOf(opener, from);
    if (start === -1) return null;
    const parenAt = start + opener.length - 1;
    let depth = 0;
    let end = -1;
    for (let i = parenAt; i < source.length; i++) {
      if (source[i] === '(') depth++;
      else if (source[i] === ')') {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }
    if (end === -1) return null;
    const chunk = source.slice(start, end + 1);
    // Match the path literal exactly, not by prefix: '/:userId/horoscope-match'
    // must not be satisfied by '/:userId/horoscope-match/pdf'.
    if (new RegExp(`^router\\.${method}\\(\\s*'${routePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`).test(chunk)) {
      return chunk;
    }
    from = end + 1;
  }
};

describe('sensitive routes carry a dedicated limiter', () => {
  it('POST /guardian/resolve-invite/:token — bearer token in the URL path', () => {
    const chain = routeChain(routeSrc('guardianRoutes.js'), 'post', '/resolve-invite/:token');
    expect(chain).not.toBeNull();
    expect(chain).toContain('sensitiveActionLimiter');
  });

  it('POST /guardian/invite — probes the user table by email', () => {
    const chain = routeChain(routeSrc('guardianRoutes.js'), 'post', '/invite');
    expect(chain).not.toBeNull();
    expect(chain).toMatch(/Limiter/);
  });
});

describe('expensive reads carry expensiveReadLimiter', () => {
  const profile = () => routeSrc('profileRoutes.js');

  it.each([
    ['/me/biodata', 'get'],
    ['/:userId/compatibility', 'get'],
    ['/:userId/horoscope-match', 'get'],
    ['/:userId/horoscope-match/pdf', 'get'],
  ])('%s', (routePath, method) => {
    const chain = routeChain(profile(), method, routePath);
    expect(chain).not.toBeNull();
    expect(chain).toContain('expensiveReadLimiter');
  });
});

describe('no route file imports a limiter it never applies', () => {
  // The exact shape of the Round 1 miss. An unused import is the signature of a
  // hardening step that was written but not wired.
  const files = fs
    .readdirSync(path.join(__dirname, '..', '..', 'routes'))
    .filter((f) => f.endsWith('.js'));

  it.each(files)('%s', (file) => {
    const source = routeSrc(file);
    const importLine = source.match(
      /const \{([^}]*)\} = require\(['"]\.\.\/middlewares\/security['"]\)/
    );
    if (!importLine) return;

    const imported = importLine[1]
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.endsWith('Limiter'));

    // Strip the import statement itself before looking for usages.
    const body = source.replace(importLine[0], '');
    const unused = imported.filter((name) => !new RegExp(`\\b${name}\\b`).test(body));

    expect(unused).toEqual([]);
  });
});
