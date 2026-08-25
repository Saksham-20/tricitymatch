import { useEffect, useState } from 'react';
import { getPlanOptions } from '../api/adminApi';

/**
 * Plans an admin may grant, from the server.
 *
 * Every admin surface that sets a plan reads this so the options match the
 * live launch offer (what the admin has on sale) AND the backend enum. A
 * hardcoded list drifted once already: `['free','basic','premium','gold']`
 * are not enum values, so every override 400'd at validation while the UI
 * reported a generic "Update failed".
 *
 * Falls back to the enum keys if the request fails, so the dropdown still
 * works when only the offer layer is unreachable.
 */
const FALLBACK = [
  { planType: 'free', label: 'Free', onSale: true },
  { planType: 'basic_premium', label: 'Basic Premium', onSale: false },
  { planType: 'premium_plus', label: 'Premium', onSale: false },
  { planType: 'elite', label: 'Elite', onSale: false },
  { planType: 'vip', label: 'VIP', onSale: false },
  { planType: 'nri', label: 'NRI Connect', onSale: false },
];

export default function usePlanOptions() {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getPlanOptions()
      .then((res) => { if (alive) setOptions(res.data.options || FALLBACK); })
      .catch(() => { if (alive) setOptions(FALLBACK); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return { options, loading };
}

/** Label for a plan key, for tables that render a plan without the picker. */
export const planLabel = (options, planType) =>
  options.find((o) => o.planType === planType)?.label || planType;
