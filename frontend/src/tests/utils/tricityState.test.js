import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { stateForCity, placeLabel, CITIES_BY_STATE } from '../../utils/tricityState';
import { CITY_VALUES } from '../../constants/profileOptions';

/**
 * Profiles never ask for the state, and the stored column defaulted to
 * "Punjab" for everyone: Panchkula (Haryana) and Chandigarh (a union territory)
 * read "…, Punjab". Pages now work the state out from the city.
 */
describe('stateForCity', () => {
  it.each([
    ['Panchkula', 'Haryana'],
    ['Pinjore', 'Haryana'],
    ['Kalka', 'Haryana'],
    ['Barwala', 'Haryana'],
    ['Raipur Rani', 'Haryana'],
    ['Ambala', 'Haryana'],
    ['Mohali', 'Punjab'],
    ['SAS Nagar', 'Punjab'],
    ['Zirakpur', 'Punjab'],
    ['Kharar', 'Punjab'],
    ['Kurali', 'Punjab'],
    ['Dera Bassi', 'Punjab'],
    ['Landran', 'Punjab'],
    ['Banur', 'Punjab'],
    ['Mullanpur', 'Punjab'],
    ['New Chandigarh', 'Punjab'],
    ['Ludhiana', 'Punjab'],
    ['Chandigarh', 'Chandigarh'],
    ['Baddi', 'Himachal Pradesh'],
    ['Shimla', 'Himachal Pradesh'],
    ['Delhi', 'Delhi'],
  ])('%s is in %s', (city, state) => {
    expect(stateForCity(city)).toBe(state);
  });

  it('knows every city in the app city list', () => {
    expect(CITY_VALUES.filter((c) => !stateForCity(c))).toEqual([]);
  });

  it.each([['Toronto'], [''], [null], [undefined]])('is null for %p', (city) => {
    expect(stateForCity(city)).toBeNull();
  });
});

describe('placeLabel', () => {
  it('names the real state', () => {
    expect(placeLabel('Panchkula')).toBe('Panchkula, Haryana');
    expect(placeLabel('Zirakpur')).toBe('Zirakpur, Punjab');
  });

  it('shows Chandigarh once, never "Chandigarh, Chandigarh"', () => {
    expect(placeLabel('Chandigarh')).toBe('Chandigarh');
  });

  it('shows an unknown or overseas city on its own', () => {
    expect(placeLabel('Toronto')).toBe('Toronto');
  });

  it('is null without a city', () => {
    expect(placeLabel('')).toBeNull();
    expect(placeLabel(null)).toBeNull();
  });
});

describe('web and server agree', () => {
  it('uses the same city list as backend/utils/tricityState.js', () => {
    const require = createRequire(import.meta.url);
    const server = require('../../../../backend/utils/tricityState.js');
    expect(CITIES_BY_STATE).toEqual(server.CITIES_BY_STATE);
    for (const city of ['Panchkula', 'Chandigarh', 'Toronto', 'S.A.S. Nagar']) {
      expect(placeLabel(city)).toBe(server.placeLabel(city));
    }
  });
});
