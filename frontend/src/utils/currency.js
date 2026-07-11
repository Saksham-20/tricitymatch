// Dynamic per-user currency display for NRI pricing.
//
// DISPLAY ONLY — every plan is still CHARGED in INR via Razorpay. We detect the
// viewer's likely currency from their browser locale / timezone and show an
// approximate local-currency figure ("indicative") next to the authoritative ₹
// price. FX rates are a hand-maintained constant table (NOT a live feed) and are
// intentionally rounded; real multi-currency settlement is future work.

// INR → foreign multiplier (1 INR = X foreign). Rounded/indicative — refresh
// periodically. Keep INR out (it's the base / authoritative price).
const FX = {
  USD: 0.012,
  GBP: 0.0094,
  EUR: 0.011,
  CAD: 0.0164,
  AUD: 0.0180,
  NZD: 0.0200,
  AED: 0.0440,
  SGD: 0.0160,
  MYR: 0.0560,
  HKD: 0.0940,
  SAR: 0.0450,
  QAR: 0.0437,
};

const SYMBOLS = {
  USD: '$', GBP: '£', EUR: '€', CAD: 'C$', AUD: 'A$', NZD: 'NZ$',
  AED: 'AED', SGD: 'S$', MYR: 'RM', HKD: 'HK$', SAR: 'SAR', QAR: 'QAR', INR: '₹',
};

// ISO-3166 region → ISO-4217 currency for the markets we support.
const REGION_CURRENCY = {
  US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD', NZ: 'NZD',
  AE: 'AED', SG: 'SGD', MY: 'MYR', HK: 'HKD', SA: 'SAR', QA: 'QAR',
  DE: 'EUR', FR: 'EUR', IE: 'EUR', NL: 'EUR', ES: 'EUR', IT: 'EUR',
};

// Coarse timezone → region fallback for NRI hubs when the locale has no region.
const TZ_REGION = {
  'America/New_York': 'US', 'America/Chicago': 'US', 'America/Los_Angeles': 'US',
  'America/Toronto': 'CA', 'America/Vancouver': 'CA',
  'Europe/London': 'GB', 'Europe/Dublin': 'IE', 'Europe/Berlin': 'DE', 'Europe/Paris': 'FR',
  'Asia/Dubai': 'AE', 'Asia/Singapore': 'SG', 'Asia/Kuala_Lumpur': 'MY', 'Asia/Hong_Kong': 'HK',
  'Asia/Riyadh': 'SA', 'Asia/Qatar': 'QA',
  'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'Pacific/Auckland': 'NZ',
};

const regionFromLocale = () => {
  try {
    const loc = (typeof navigator !== 'undefined' && (navigator.language || navigator.languages?.[0])) || '';
    // e.g. "en-US" → "US"; "en-GB" → "GB"
    const parts = loc.split('-');
    if (parts.length > 1) {
      const r = parts[parts.length - 1].toUpperCase();
      if (r.length === 2) return r;
    }
  } catch { /* noop */ }
  return null;
};

const regionFromTimezone = () => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TZ_REGION[tz] || null;
  } catch { /* noop */ }
  return null;
};

/**
 * Detect the viewer's display currency.
 * @returns {{ code: string, symbol: string, locale: string }} — falls back to INR.
 */
export const detectCurrency = () => {
  const region = regionFromLocale() || regionFromTimezone();
  const code = (region && REGION_CURRENCY[region]) || 'INR';
  const locale = (typeof navigator !== 'undefined' && navigator.language) || 'en-IN';
  return { code, symbol: SYMBOLS[code] || code, locale };
};

/**
 * Convert an INR (rupee) amount to the viewer's currency and format it.
 * Returns null for INR (no conversion needed) or unknown currencies.
 * @param {number} inrRupees  amount in rupees
 * @param {{ code: string, locale: string }} currency
 */
export const formatLocalPrice = (inrRupees, currency) => {
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
};

export const FX_RATES = FX;
