/**
 * FUN-04: on Chrome the Punjabi launch banner read "11 M10", "M10 2026" and
 * "Sun", because Chrome has no Punjabi date data. The words now come from our
 * own list, so the banner reads the same in every browser.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { setLanguage } from '../i18n';
import LaunchBanner from '../components/home/LaunchBanner';

beforeAll(async () => {
  await setLanguage('pa');
  // Behave like Chrome: no Punjabi words from Intl.
  const real = Date.prototype.toLocaleDateString;
  vi.spyOn(Date.prototype, 'toLocaleDateString').mockImplementation(function (locale, ...rest) {
    if (!/^pa/.test(String(locale))) return real.call(this, locale, ...rest);
    const opts = rest[0] || {};
    if (opts.month) return 'M10';
    if (opts.weekday) return 'Sun';
    return real.call(this, locale, ...rest);
  });
});

afterAll(async () => {
  vi.restoreAllMocks();
  await setLanguage('en');
});

describe('home LaunchBanner in Punjabi', () => {
  it('names the month and weekday in Gurmukhi before launch', () => {
    const { container } = render(<MemoryRouter><LaunchBanner now={new Date('2026-10-06T06:00:00Z')} /></MemoryRouter>);
    const text = container.textContent;
    expect(text).toContain('ਅਕਤੂਬਰ');
    expect(text).toContain('ਅਕਤੂਬਰ 2026');
    expect(text).toContain('ਐਤਵਾਰ');
    expect(text).not.toMatch(/M10|\bSun\b/);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toContain('11 ਅਕਤੂਬਰ');
  });
});
