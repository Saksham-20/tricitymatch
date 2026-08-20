import { useEffect, useState } from 'react';
import api from '../api/axios';

/**
 * Is the founding-member offer open right now? (Phase S)
 *
 * Sole source of truth is the server (`GET /subscription/plans` → `founding`),
 * because the grant itself is server-gated on `FOUNDING_PERIOD_ENDS`. Any surface
 * that promises "free premium period" without asking would be promising an
 * entitlement nobody receives — the exact class of claim Phase 0 stripped off
 * this site.
 *
 * Contract:
 *  - Defaults to CLOSED and stays closed on any failure (fail-closed).
 *  - `loading` is exposed so a surface can hold back the *stronger* claim for a
 *    beat rather than flashing it and taking it away.
 *  - The answer is process-cached: it changes on a deploy/env edit, not per
 *    render, and several surfaces (landing band, city pages, signup) ask for it
 *    on the same page load.
 */

const CLOSED = { open: false, endsAt: null, contactUnlocks: 3 };

let cached = null;
let inflight = null;

const fetchFounding = () => {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = api
      .get('/subscription/plans')
      .then(({ data }) => {
        cached = data?.founding?.open ? { ...CLOSED, ...data.founding } : CLOSED;
        return cached;
      })
      .catch(() => CLOSED)
      .finally(() => { inflight = null; });
  }
  return inflight;
};

export default function useFoundingWindow() {
  const [state, setState] = useState(() => (cached ? { ...cached, loading: false } : { ...CLOSED, loading: true }));

  useEffect(() => {
    if (cached) return undefined;
    let alive = true;
    fetchFounding().then((founding) => {
      if (alive) setState({ ...founding, loading: false });
    });
    return () => { alive = false; };
  }, []);

  return state;
}

/** Test seam — resets the process cache between cases. */
export const __resetFoundingCache = () => { cached = null; inflight = null; };
