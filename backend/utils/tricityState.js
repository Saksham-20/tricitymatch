'use strict';

/**
 * Which state or union territory a city is in, for showing "City, State".
 *
 * Profiles never ask for the state. The stored column defaulted to "Punjab" for
 * everyone, so a Panchkula profile (Haryana) and a Chandigarh one (a union
 * territory) both read "…, Punjab". Display works the state out from the city
 * instead and never shows the stored column. A city we do not know (a town not
 * listed here, or one abroad) is shown on its own, without a state.
 *
 * Keep in step with frontend/src/utils/tricityState.js (same list, same rules).
 */

const CHANDIGARH = 'Chandigarh';
const PUNJAB = 'Punjab';
const HARYANA = 'Haryana';
const HIMACHAL = 'Himachal Pradesh';
const DELHI = 'Delhi';

const CITIES_BY_STATE = {
  [CHANDIGARH]: ['Chandigarh'],
  [PUNJAB]: [
    // Mohali (SAS Nagar) district: the Punjab side of the Tricity
    'Mohali', 'SAS Nagar', 'Sahibzada Ajit Singh Nagar', 'Zirakpur', 'Baltana', 'Kharar',
    'Kurali', 'Derabassi', 'Dera Bassi', 'Lalru', 'Landran', 'Banur', 'Mullanpur',
    'Mullanpur Garibdass', 'New Chandigarh',
    // Further out in Punjab
    'Rajpura', 'Patiala', 'Rupnagar (Ropar)', 'Rupnagar', 'Ropar', 'Morinda', 'Sirhind',
    'Fatehgarh Sahib', 'Khanna', 'Ludhiana', 'Jalandhar', 'Amritsar', 'Bathinda',
    'Hoshiarpur', 'Pathankot', 'Phagwara', 'Kapurthala', 'Moga', 'Sangrur', 'Barnala',
    'Nawanshahr', 'Nangal', 'Anandpur Sahib',
  ],
  [HARYANA]: [
    // Panchkula district: the Haryana side of the Tricity
    'Panchkula', 'Pinjore', 'Kalka', 'Barwala', 'Raipur Rani',
    // Further out in Haryana
    'Ambala', 'Ambala Cantt', 'Ambala City', 'Naraingarh', 'Yamunanagar', 'Jagadhri',
    'Kurukshetra', 'Karnal', 'Kaithal', 'Panipat', 'Sonipat', 'Rohtak', 'Hisar', 'Sirsa',
    'Jind', 'Bhiwani', 'Rewari', 'Gurugram', 'Gurgaon', 'Faridabad',
  ],
  [HIMACHAL]: [
    'Baddi', 'Nalagarh', 'Parwanoo', 'Kasauli', 'Solan', 'Shimla', 'Dharamshala',
    'Kullu', 'Manali',
  ],
  [DELHI]: ['Delhi', 'New Delhi'],
  'Uttar Pradesh': ['Noida', 'Greater Noida', 'Ghaziabad', 'Lucknow'],
  Uttarakhand: ['Dehradun'],
  'Jammu and Kashmir': ['Jammu', 'Srinagar'],
  Rajasthan: ['Jaipur'],
  Gujarat: ['Ahmedabad'],
  Maharashtra: ['Mumbai', 'Pune'],
  Karnataka: ['Bengaluru', 'Bangalore'],
  'Tamil Nadu': ['Chennai'],
  Telangana: ['Hyderabad'],
  'West Bengal': ['Kolkata'],
};

// "S.A.S. Nagar", " sas  nagar " and "SAS Nagar" are the same place.
const cityKey = (city) => String(city).toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();

const STATE_BY_CITY = new Map(
  Object.entries(CITIES_BY_STATE).flatMap(([state, cities]) => cities.map((c) => [cityKey(c), state]))
);

/** The state or union territory for a city, or null when we do not know it. */
const stateForCity = (city) => {
  if (typeof city !== 'string' || !city.trim()) return null;
  return STATE_BY_CITY.get(cityKey(city)) || null;
};

/**
 * "Mohali, Punjab", "Panchkula, Haryana", plain "Chandigarh" (never
 * "Chandigarh, Chandigarh"), and the city alone when its state is unknown.
 * Null when there is no city.
 */
const placeLabel = (city) => {
  if (typeof city !== 'string' || !city.trim()) return null;
  const name = city.trim();
  const state = stateForCity(name);
  if (!state || cityKey(state) === cityKey(name)) return name;
  return `${name}, ${state}`;
};

module.exports = { stateForCity, placeLabel, CITIES_BY_STATE };
