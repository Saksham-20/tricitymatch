#!/usr/bin/env node
/**
 * Dependency-free secret scanner.
 *
 * Added by the 2026-08-21 deep security audit. The audit confirmed git history
 * was clean of live credentials, but four `.env` files and four seed-credential
 * files had been committed at various points. This keeps that true.
 *
 * Usage:
 *   node scripts/scan-secrets.mjs              # scan tracked files at HEAD
 *   node scripts/scan-secrets.mjs --staged     # scan staged changes (pre-commit)
 *   node scripts/scan-secrets.mjs --history    # scan every blob in git history
 *
 * Exit 1 on any finding. Placeholders are deliberately NOT matched -- the rules
 * below target real credential shapes, and known-template values are allowlisted.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

const RULES = [
  { id: 'razorpay-live-key',   re: /\brzp_live_[A-Za-z0-9]{10,}/ },
  { id: 'razorpay-secret',     re: /RAZORPAY_KEY_SECRET\s*[:=]\s*['"]?[A-Za-z0-9]{15,}/ },
  { id: 'resend-key',          re: /\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{20,}/ },
  { id: 'aws-access-key',      re: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: 'google-api-key',      re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { id: 'google-oauth-secret', re: /\bGOCSPX-[A-Za-z0-9_-]{20,}/ },
  { id: 'github-token',        re: /\bgh[pousr]_[A-Za-z0-9]{30,}/ },
  { id: 'slack-token',         re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/ },
  { id: 'stripe-live-key',     re: /\bsk_live_[A-Za-z0-9]{16,}/ },
  { id: 'private-key-block',   re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/ },
  { id: 'cloudinary-url',      re: /cloudinary:\/\/\d{6,}:[A-Za-z0-9_-]{15,}@/ },
  { id: 'cloudinary-secret',   re: /CLOUDINARY_API_SECRET\s*[:=]\s*['"]?[A-Za-z0-9_-]{20,}/ },
  { id: 'jwt-secret-literal',  re: /(?:JWT|COOKIE|CSRF)_SECRET\s*[:=]\s*['"]?[A-Za-z0-9+/=_-]{40,}/ },
  { id: 'msg91-authkey',       re: /(?:SMS_API_KEY|AUTHKEY)\s*[:=]\s*['"]?[A-Za-z0-9]{22,}/ },
  { id: 'agora-certificate',   re: /AGORA_APP_CERTIFICATE\s*[:=]\s*['"]?[a-f0-9]{28,}/ },
  { id: 'firebase-sa-json',    re: /"type"\s*:\s*"service_account"/ },
  { id: 'generic-db-url',      re: /(?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis|rediss):\/\/[^:\s'"]+:[^@\s'"]{8,}@/ },
];

// Values that are template text, test fixtures, or documented weak defaults.
const ALLOW = [
  /x{6,}/i, /your[-_]/i, /placeholder/i, /change[-_]?(this|me)/i, /replace[-_]?me/i,
  /<[A-Z_]+>/, /example\.com/i, /user:password/i, /\bdummy\b/i, /\btodo\b/i,
  /test[-_]/i, /for-ci-testing/i, /localhost/i, /127\.0\.0\.1/,
  // Two values that appear in deleted git-history blobs and were verified benign
  // by the 2026-08-21 audit: the .env.example COOKIE_SECRET template string, and
  // the development JWT_SECRET default. Neither was ever a live credential.
  /another-secure-random-string-for-cookies/, /dev-super-secret-jwt-key/,
  // A shell/compose variable reference is by definition not a literal secret.
  /\$\{[A-Za-z_][A-Za-z0-9_]*\}/, /\$[A-Z_]{3,}\b/,
  // Documentation shorthand for a PEM block, e.g. "-----BEGIN PRIVATE KEY-----\n..."
  /PRIVATE KEY-----\\n\.\.\./,
];

// Paths that legitimately contain credential-shaped test data.
const SKIP_PATH = [
  /^backend\/tests\//, /^e2e\//, /^frontend\/src\/tests\//, /^mobile\/.*__tests__\//,
  /package-lock\.json$/, /\.(png|jpe?g|gif|webp|svg|ico|pdf|ttf|otf|woff2?|keystore|jks|p12)$/i,
  /^docs\/qa-artifacts\//, /^scripts\/scan-secrets\.mjs$/,
];

const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 256 });

const scanText = (text, path, locate) => {
  const findings = [];
  for (const { id, re } of RULES) {
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length > 4000) continue;
      const m = line.match(re);
      if (!m) continue;
      if (ALLOW.some((a) => a.test(line))) continue;
      findings.push({ id, path, line: locate ? i + 1 : null, snippet: m[0].slice(0, 40) });
    }
  }
  return findings;
};

const mode = process.argv[2] || '--tracked';
let findings = [];

if (mode === '--history') {
  const blobs = git(['cat-file', '--batch-check', '--batch-all-objects'])
    .split('\n')
    .filter((l) => {
      const [, type, size] = l.split(' ');
      return type === 'blob' && Number(size) > 0 && Number(size) < 400000;
    })
    .map((l) => l.split(' ')[0]);
  process.stderr.write(`scanning ${blobs.length} history blobs...\n`);
  for (const sha of blobs) {
    let content;
    try { content = execFileSync('git', ['cat-file', 'blob', sha], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 8 }); }
    catch { continue; }
    findings.push(...scanText(content, `blob ${sha.slice(0, 12)}`, false));
  }
} else {
  const files = (mode === '--staged'
    ? git(['diff', '--cached', '--name-only', '--diff-filter=ACM'])
    : git(['ls-files'])
  ).split('\n').filter(Boolean).filter((f) => !SKIP_PATH.some((r) => r.test(f)));

  for (const f of files) {
    let st; try { st = statSync(f); } catch { continue; }
    if (!st.isFile() || st.size > 2_000_000) continue;
    let content; try { content = readFileSync(f, 'utf8'); } catch { continue; }
    findings.push(...scanText(content, f, true));
  }
}

if (findings.length === 0) {
  console.log('secret scan: clean');
  process.exit(0);
}

console.error(`\nsecret scan: ${findings.length} potential credential(s) found\n`);
for (const f of findings) {
  console.error(`  [${f.id}] ${f.path}${f.line ? ':' + f.line : ''}  ->  ${f.snippet}...`);
}
console.error('\nIf a match is a placeholder or fixture, add it to ALLOW/SKIP_PATH in scripts/scan-secrets.mjs.\n');
process.exit(1);
