/**
 * Human name for an internal plan key. The panel used to print the raw enum in
 * places ("founding_premium", "Premium_plus"); one map keeps every screen
 * calling the same plan by the same name the member sees.
 */
const LABELS = {
  free: 'Free',
  basic_premium: 'Basic',
  premium_plus: 'Premium',
  elite: 'Elite',
  vip: 'VIP',
  nri: 'NRI Connect',
  founding_premium: 'Founding',
};

export default function planLabel(key) {
  if (!key) return '—';
  return LABELS[key] || String(key).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
