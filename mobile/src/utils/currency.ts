// Dynamic per-user currency DISPLAY for NRI pricing — native port of the web
// util (frontend/src/utils/currency.js). Every plan is still CHARGED in INR;
// we only show an indicative local-currency figure next to the ₹ price.
//
// Region detection: expo-localization if linked (native build), else the Hermes
// Intl timezone, else INR. FX table is hand-maintained/indicative (not a feed).
import type { SubscriptionPlanType } from '../types';

const FX: Record<string, number> = {
  USD: 0.012, GBP: 0.0094, EUR: 0.011, CAD: 0.0164, AUD: 0.018, NZD: 0.02,
  AED: 0.044, SGD: 0.016, MYR: 0.056, HKD: 0.094, SAR: 0.045, QAR: 0.0437,
};

const SYMBOLS: Record<string, string> = {
  USD: '$', GBP: '£', EUR: '€', CAD: 'C$', AUD: 'A$', NZD: 'NZ$',
  AED: 'AED', SGD: 'S$', MYR: 'RM', HKD: 'HK$', SAR: 'SAR', QAR: 'QAR', INR: '₹',
};

const REGION_CURRENCY: Record<string, string> = {
  US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD', NZ: 'NZD',
  AE: 'AED', SG: 'SGD', MY: 'MYR', HK: 'HKD', SA: 'SAR', QA: 'QAR',
  DE: 'EUR', FR: 'EUR', IE: 'EUR', NL: 'EUR', ES: 'EUR', IT: 'EUR',
};

const TZ_REGION: Record<string, string> = {
  'America/New_York': 'US', 'America/Chicago': 'US', 'America/Los_Angeles': 'US',
  'America/Toronto': 'CA', 'America/Vancouver': 'CA',
  'Europe/London': 'GB', 'Europe/Dublin': 'IE', 'Europe/Berlin': 'DE', 'Europe/Paris': 'FR',
  'Asia/Dubai': 'AE', 'Asia/Singapore': 'SG', 'Asia/Kuala_Lumpur': 'MY', 'Asia/Hong_Kong': 'HK',
  'Asia/Riyadh': 'SA', 'Asia/Qatar': 'QA',
  'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'Pacific/Auckland': 'NZ',
};

export interface DetectedCurrency { code: string; symbol: string; locale: string }

function regionFromLocalization(): { region: string | null; locale: string | null } {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const loc = require('expo-localization');
    const locales = loc.getLocales?.() ?? [];
    const first = locales[0];
    if (first) {
      return { region: first.regionCode ?? null, locale: first.languageTag ?? null };
    }
  } catch { /* not linked (Expo Go) */ }
  return { region: null, locale: null };
}

function regionFromTimezone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TZ_REGION[tz] || null;
  } catch { return null; }
}

// Detect display currency. Falls back to INR.
export function detectCurrency(): DetectedCurrency {
  const fromLoc = regionFromLocalization();
  const region = fromLoc.region || regionFromTimezone();
  const code = (region && REGION_CURRENCY[region]) || 'INR';
  return { code, symbol: SYMBOLS[code] || code, locale: fromLoc.locale || 'en-IN' };
}

// Convert an INR (rupee) amount to the viewer's currency + format. Returns null
// for INR or unknown currencies (caller shows the plain ₹ price).
export function formatLocalPrice(inrRupees: number, currency: DetectedCurrency | null): string | null {
  if (!currency || currency.code === 'INR') return null;
  const rate = FX[currency.code];
  if (!rate || !inrRupees) return null;
  const amount = inrRupees * rate;
  try {
    return new Intl.NumberFormat(currency.locale || 'en-US', {
      style: 'currency',
      currency: currency.code,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency.symbol || currency.code} ${Math.round(amount).toLocaleString()}`;
  }
}

export type { SubscriptionPlanType };
