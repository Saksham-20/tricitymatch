import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getRankingWeights, saveRankingWeights, resetRankingWeights } from '../../api/adminApi';

const PLAN_LABELS = {
  basic_premium: 'Basic Premium',
  premium_plus: 'Premium',
  elite: 'Elite',
  vip: 'VIP',
  nri: 'NRI',
};

// Points added to a profile's compatibility score when search orders results.
// Compatibility itself runs 0-100, so these are on the same scale.
function Row({ label, hint, value, min, max, onChange, defaultValue }) {
  const changed = value !== defaultValue;
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {changed && <span className="text-xs text-gray-400">default {defaultValue}</span>}
        <input
          type="number" value={value} min={min} max={max} aria-label={label}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
    </div>
  );
}

export default function AdminRanking() {
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const res = await getRankingWeights();
      setData(res.data);
      setDraft(res.data.weights);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (error) {
    return <p className="text-sm text-red-700">Could not load ranking weights. <button className="underline" onClick={load}>Retry</button></p>;
  }
  if (!data || !draft) return <p className="text-sm text-gray-400">Loading…</p>;

  const { defaults, limits } = data;
  const setPlan = (key, v) => setDraft({ ...draft, plans: { ...draft.plans, [key]: v } });
  const dirty = JSON.stringify(draft) !== JSON.stringify(data.weights);

  const save = async () => {
    setBusy(true);
    try {
      const res = await saveRankingWeights(draft);
      setData({ ...data, weights: res.data.weights });
      setDraft(res.data.weights);
      toast.success('Ranking updated — live now');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    try {
      const res = await resetRankingWeights();
      setData({ ...data, weights: res.data.weights });
      setDraft(res.data.weights);
      toast.success('Back to the defaults');
    } catch {
      toast.error('Could not reset');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Search ranking</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Search orders profiles by compatibility (0–100) plus the points below. Every search result
          also carries the factors behind its position. Changes are live within a minute.
        </p>
      </div>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 divide-y divide-gray-50">
        <h2 className="pt-4 pb-2 text-sm font-semibold text-gray-700">Paid plan</h2>
        {Object.keys(defaults.plans).map((key) => (
          <Row key={key} label={PLAN_LABELS[key] || key} value={draft.plans[key]} defaultValue={defaults.plans[key]}
            min={limits.plan[0]} max={limits.plan[1]} onChange={(v) => setPlan(key, v)} />
        ))}
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 divide-y divide-gray-50">
        <h2 className="pt-4 pb-2 text-sm font-semibold text-gray-700">Other signals</h2>
        <Row label="Profile boost" hint="A member who is currently boosted" value={draft.boosted} defaultValue={defaults.boosted}
          min={limits.boosted[0]} max={limits.boosted[1]} onChange={(v) => setDraft({ ...draft, boosted: v })} />
        <Row label="Photo verified" hint="Rewards getting verified" value={draft.verified} defaultValue={defaults.verified}
          min={limits.verified[0]} max={limits.verified[1]} onChange={(v) => setDraft({ ...draft, verified: v })} />
        <Row label="No photo" hint="Negative. Keep it larger than any single boost above so a plan cannot buy it back"
          value={draft.noPhoto} defaultValue={defaults.noPhoto}
          min={limits.noPhoto[0]} max={limits.noPhoto[1]} onChange={(v) => setDraft({ ...draft, noPhoto: v })} />
      </section>

      <div className="flex gap-2">
        <button disabled={busy || !dirty} onClick={save}
          className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm disabled:opacity-50">Save</button>
        <button disabled={busy} onClick={reset}
          className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 disabled:opacity-50">Reset to defaults</button>
      </div>
    </div>
  );
}
