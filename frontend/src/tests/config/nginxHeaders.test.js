import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The shipped nginx must not forbid the camera and microphone for the app's own
 * origin. Live selfie verification, voice notes and in-browser calls all call
 * getUserMedia; `camera=()` made every one of them fail in production while
 * working in dev (Vite sends no such header).
 */
const conf = readFileSync(resolve(__dirname, '../../../nginx.conf'), 'utf8');
const policies = conf.split('\n').filter((l) => l.includes('add_header Permissions-Policy'));

describe('frontend/nginx.conf Permissions-Policy', () => {
  it('sets the header in every location block that declares its own headers', () => {
    expect(policies.length).toBeGreaterThanOrEqual(4);
  });

  it.each(policies.map((p, i) => [i, p.trim()]))('line %i allows camera and microphone for self only', (_i, line) => {
    expect(line).toContain('camera=(self)');
    expect(line).toContain('microphone=(self)');
    expect(line).toContain('geolocation=()');
    expect(line).not.toMatch(/camera=\(\)|microphone=\(\)/);
    expect(line).not.toMatch(/=\*/);
  });
});
