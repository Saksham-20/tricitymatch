import { normalizeMatchActionResponse } from './matchAction';

const match = { id: 'm1', isMutual: false } as never;

describe('normalizeMatchActionResponse', () => {
  it('reads the flag the server actually sends (isMutual)', () => {
    expect(normalizeMatchActionResponse({ isMutual: true, match }).isMutualMatch).toBe(true);
  });

  it('keeps isMutualMatch when a server sends that spelling', () => {
    expect(normalizeMatchActionResponse({ isMutualMatch: true, match }).isMutualMatch).toBe(true);
  });

  it('falls back to the returned match row', () => {
    expect(normalizeMatchActionResponse({ match: { id: 'm1', isMutual: true } as never }).isMutualMatch).toBe(true);
  });

  it('is false when nothing says it is mutual', () => {
    expect(normalizeMatchActionResponse({ isMutual: false, match }).isMutualMatch).toBe(false);
    expect(normalizeMatchActionResponse({}).isMutualMatch).toBe(false);
  });
});
