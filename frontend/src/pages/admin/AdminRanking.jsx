import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  getRankingWeights, saveRankingWeights, resetRankingWeights,
  getRankingExperiment, startRankingExperiment, stopRankingExperiment,
} from '../../api/adminApi';

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

const SIGNALS = [
  ['verified', 'Photo verified'],
  ['boosted', 'Profile boost'],
  ['noPhoto', 'No photo'],
];

// One experiment at a time: a share of members (chosen by a stable hash of their
// id) is ranked with changed weights; everyone else keeps the live ones.
function ExperimentSection() {
  const [state, setState] = useState(null);
  const [form, setForm] = useState({ name: '', sharePct: 20, overrides: {} });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const res = await getRankingExperiment();
      setState(res.data);
    } catch {
      setError(true);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (error) {
    return <p className="text-sm text-red-700">Could not load the experiment. <button className="underline" onClick={load}>Retry</button></p>;
  }
  if (!state) return null;

  const exp = state.experiment;
  const running = Boolean(exp && exp.enabled);

  const start = async () => {
    const overrides = {};
    for (const [key] of SIGNALS) if (form.overrides[key] !== undefined && form.overrides[key] !== '') overrides[key] = Number(form.overrides[key]);
    setBusy(true);
    try {
      await startRankingExperiment({ name: form.name, sharePct: Number(form.sharePct), overrides });
      toast.success('Experiment started');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not start');
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    try {
      await stopRankingExperiment();
      toast.success('Stopped — everyone is back on the live weights');
      await load();
    } catch {
      toast.error('Could not stop');
    } finally {
      setBusy(false);
    }
  };

  const arm = (label, r) => (
    <tr key={label} className="border-t border-gray-50">
      <td className="py-2 pr-4 text-sm text-gray-700">{label}</td>
      <td className="py-2 pr-4 text-sm text-right">{r ? r.members : '—'}</td>
      <td className="py-2 pr-4 text-sm text-right">{r ? r.interestsSent : '—'}</td>
      <td className="py-2 pr-4 text-sm text-right">{r ? r.interestsPerMember : '—'}</td>
      <td className="py-2 text-sm text-right">{r ? r.mutualMatches : '—'}</td>
    </tr>
  );

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-700">Ranking experiment</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Rank a share of members with changed weights and compare what they do. A member stays in the
          same group for the whole experiment. Stopping returns everyone to the live weights.
        </p>
      </div>

      {exp && (
        <div className="text-sm text-gray-700">
          <p>
            <span className="font-medium">{exp.name}</span>{' '}
            <span className={running ? 'text-green-700' : 'text-gray-400'}>({running ? 'running' : 'stopped'})</span>
            {' · '}{exp.sharePct}% get the variant · since {new Date(exp.startedAt).toLocaleDateString('en-IN')}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Variant changes: {Object.entries(exp.overrides).map(([k, v]) => `${k} ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(', ')}
          </p>
          {state.results && (
            <table className="mt-3 w-full">
              <thead>
                <tr className="text-xs text-gray-400 text-left">
                  <th className="pr-4 font-medium">Group</th>
                  <th className="pr-4 font-medium text-right">Members</th>
                  <th className="pr-4 font-medium text-right">Interests sent</th>
                  <th className="pr-4 font-medium text-right">Per member</th>
                  <th className="font-medium text-right">Mutual</th>
                </tr>
              </thead>
              <tbody>{arm('Live weights', state.results.control)}{arm('Variant', state.results.variant)}</tbody>
            </table>
          )}
          {running && (
            <button disabled={busy} onClick={stop}
              className="mt-3 px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 disabled:opacity-50">Stop experiment</button>
          )}
        </div>
      )}

      {!running && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <label className="text-xs text-gray-500">
              Name
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="verified-boost"
                className="mt-1 block w-44 border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
            </label>
            <label className="text-xs text-gray-500">
              % in the variant (1–{state.maxShare})
              <input type="number" min={1} max={state.maxShare} value={form.sharePct}
                onChange={(e) => setForm({ ...form, sharePct: e.target.value })}
                className="mt-1 block w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
            </label>
            {SIGNALS.map(([key, label]) => (
              <label key={key} className="text-xs text-gray-500">
                {label} (blank = unchanged)
                <input type="number" value={form.overrides[key] ?? ''}
                  onChange={(e) => setForm({ ...form, overrides: { ...form.overrides, [key]: e.target.value } })}
                  className="mt-1 block w-28 border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
              </label>
            ))}
          </div>
          <button disabled={busy || !form.name} onClick={start}
            className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm disabled:opacity-50">Start experiment</button>
        </div>
      )}
    </section>
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

      <ExperimentSection />
    </div>
  );
}
