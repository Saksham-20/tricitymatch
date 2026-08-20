import { useState, useEffect, useCallback } from 'react';
import { Tag, Save, RefreshCw, AlertCircle, Crown, Clock } from 'lucide-react';
import apiClient from '../../api/apiClient';

/**
 * Launch-offer editor.
 *
 * The owner sets launch prices, tenures, unlock caps and the offer deadline
 * here instead of in env, so pricing changes need no redeploy. Everything is
 * edited in RUPEES and DAYS; paise conversion happens on submit, because a
 * pricing screen that asks a human for paise is a mis-charge waiting to happen.
 *
 * Each row shows the regular price it reverts to when the window closes, so a
 * discount is never set blind.
 */

const PLAN_KEYS = ['basic_premium', 'premium_plus', 'elite', 'vip', 'nri'];
const BUNDLE_KEYS = ['bundle_3', 'bundle_10', 'bundle_25'];

const PLAN_LABELS = {
  basic_premium: 'Basic',
  premium_plus: 'Premium',
  elite: 'Elite',
  vip: 'VIP',
  nri: 'NRI Connect',
};

// <input type="datetime-local"> wants local wall-clock with no zone.
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

const rupees = (paise) => (paise || paise === 0 ? Math.round(paise / 100) : '');

export default function AdminLaunchOffer() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get('/admin/launch-offer');
      const offer = res.data.offer;
      setData(res.data);
      setForm({
        enabled: Boolean(offer.enabled),
        endsAt: toLocalInput(offer.endsAt),
        headline: offer.headline || '',
        subline: offer.subline || '',
        plans: Object.fromEntries(PLAN_KEYS.map((k) => {
          const p = offer.plans?.[k] || {};
          return [k, {
            price: rupees(p.amount),
            duration: p.duration ?? '',
            // Empty string = unlimited, mirroring the API's null.
            contactUnlocks: p.contactUnlocks === null || p.contactUnlocks === undefined ? '' : p.contactUnlocks,
            mrp: rupees(p.mrp),
          }];
        })),
        bundles: Object.fromEntries(BUNDLE_KEYS.map((k) => {
          const b = offer.bundles?.[k] || {};
          return [k, { hidden: Boolean(b.hidden), price: rupees(b.amount) }];
        })),
        founding: {
          enabled: Boolean(offer.founding?.enabled),
          endsAt: toLocalInput(offer.founding?.endsAt),
          memberCap: offer.founding?.memberCap ?? 0,
          grantDays: offer.founding?.grantDays ?? 30,
          contactUnlocks: offer.founding?.contactUnlocks ?? 3,
        },
      });
    } catch (e) {
      setError(e.response?.data?.error?.message || 'Failed to load launch offer');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setPlanField = (key, field, value) =>
    setForm((f) => ({ ...f, plans: { ...f.plans, [key]: { ...f.plans[key], [field]: value } } }));
  const setBundleField = (key, field, value) =>
    setForm((f) => ({ ...f, bundles: { ...f.bundles, [key]: { ...f.bundles[key], [field]: value } } }));
  const setFounding = (field, value) =>
    setForm((f) => ({ ...f, founding: { ...f.founding, [field]: value } }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved('');
    try {
      const payload = {
        enabled: form.enabled,
        endsAt: fromLocalInput(form.endsAt),
        headline: form.headline,
        subline: form.subline,
        plans: Object.fromEntries(PLAN_KEYS.map((k) => {
          const p = form.plans[k];
          return [k, {
            amount: Math.round(Number(p.price) * 100),
            duration: Number(p.duration),
            contactUnlocks: p.contactUnlocks === '' ? null : Number(p.contactUnlocks),
            mrp: p.mrp === '' ? null : Math.round(Number(p.mrp) * 100),
          }];
        })),
        bundles: Object.fromEntries(BUNDLE_KEYS.map((k) => {
          const b = form.bundles[k];
          return [k, b.hidden ? { hidden: true } : { amount: Math.round(Number(b.price) * 100) }];
        })),
        founding: {
          enabled: form.founding.enabled,
          endsAt: fromLocalInput(form.founding.endsAt),
          memberCap: Number(form.founding.memberCap),
          grantDays: Number(form.founding.grantDays),
          contactUnlocks: Number(form.founding.contactUnlocks),
        },
      };
      const res = await apiClient.put('/admin/launch-offer', payload);
      setSaved(res.data.state?.active ? 'Saved — launch pricing is live.' : 'Saved — regular pricing is in effect.');
      await load();
    } catch (e) {
      setError(e.response?.data?.error?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-8 w-56 bg-neutral-200 rounded animate-pulse mb-4" />
        <div className="h-64 bg-neutral-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertCircle className="w-5 h-5" /> {error || 'Launch offer unavailable'}
        </div>
        <button onClick={load} className="mt-4 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold">Retry</button>
      </div>
    );
  }

  const state = data?.state;

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
            <Tag className="w-6 h-6 text-primary-600" /> Launch Offer
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Time-boxed launch pricing. Changes apply immediately to checkout — no deploy needed.
          </p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-200 text-sm text-neutral-600 hover:bg-neutral-50">
          <RefreshCw className="w-4 h-4" /> Reload
        </button>
      </div>

      <div className={`mb-6 rounded-xl border px-4 py-3 flex items-center gap-3 ${
        state?.active ? 'bg-green-50 border-green-200 text-green-800' : 'bg-neutral-50 border-neutral-200 text-neutral-700'
      }`}>
        <Clock className="w-4 h-4 flex-shrink-0" />
        <p className="text-sm">
          {state?.active
            ? <>Launch pricing is <strong>live</strong>{state.endsAt ? <> until {new Date(state.endsAt).toLocaleString('en-IN')}</> : ' (no end date set)'}.</>
            : <>Launch pricing is <strong>off</strong> — members are charged the regular ladder.</>}
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}
      {saved && (
        <div className="mb-4 text-green-800 bg-green-50 border border-green-200 rounded-lg p-3 text-sm">{saved}</div>
      )}

      <form onSubmit={submit} className="space-y-8">
        {/* Window */}
        <section className="bg-white border border-neutral-200 rounded-xl p-5">
          <h2 className="font-semibold text-neutral-900 mb-4">Offer window</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center gap-3 text-sm text-neutral-700">
              <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} className="w-4 h-4" />
              Launch pricing enabled
            </label>
            <label className="text-sm text-neutral-700">
              Ends at
              <input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                className="mt-1 w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm" />
              <span className="text-xs text-neutral-400">Leave blank to run until switched off.</span>
            </label>
            <label className="text-sm text-neutral-700">
              Headline
              <input value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} maxLength={80}
                className="mt-1 w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm" />
            </label>
            <label className="text-sm text-neutral-700">
              Subline
              <input value={form.subline} onChange={(e) => setForm({ ...form, subline: e.target.value })} maxLength={200}
                className="mt-1 w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm" />
            </label>
          </div>
        </section>

        {/* Plans */}
        <section className="bg-white border border-neutral-200 rounded-xl p-5 overflow-x-auto">
          <h2 className="font-semibold text-neutral-900 mb-1">Plan pricing</h2>
          <p className="text-xs text-neutral-500 mb-4">
            Prices in ₹, tenure in days. Leave unlocks blank for unlimited. MRP is the struck-through anchor shown to members.
          </p>
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-neutral-500 border-b border-neutral-200">
                <th className="py-2 pr-3">Plan</th>
                <th className="py-2 pr-3">Launch ₹</th>
                <th className="py-2 pr-3">Days</th>
                <th className="py-2 pr-3">Unlocks</th>
                <th className="py-2 pr-3">MRP ₹</th>
                <th className="py-2">Reverts to</th>
              </tr>
            </thead>
            <tbody>
              {PLAN_KEYS.map((k) => {
                const reg = data?.regular?.[k];
                const p = form.plans[k];
                return (
                  <tr key={k} className="border-b border-neutral-100 last:border-0">
                    <td className="py-2 pr-3 font-medium text-neutral-800">{PLAN_LABELS[k]}</td>
                    <td className="py-2 pr-3">
                      <input type="number" min="1" value={p.price} onChange={(e) => setPlanField(k, 'price', e.target.value)}
                        className="w-24 border border-neutral-200 rounded-lg px-2 py-1.5" required />
                    </td>
                    <td className="py-2 pr-3">
                      <input type="number" min="1" max="730" value={p.duration} onChange={(e) => setPlanField(k, 'duration', e.target.value)}
                        className="w-20 border border-neutral-200 rounded-lg px-2 py-1.5" required />
                    </td>
                    <td className="py-2 pr-3">
                      <input type="number" min="0" value={p.contactUnlocks} placeholder="∞" onChange={(e) => setPlanField(k, 'contactUnlocks', e.target.value)}
                        className="w-20 border border-neutral-200 rounded-lg px-2 py-1.5" />
                    </td>
                    <td className="py-2 pr-3">
                      <input type="number" min="0" value={p.mrp} onChange={(e) => setPlanField(k, 'mrp', e.target.value)}
                        className="w-24 border border-neutral-200 rounded-lg px-2 py-1.5" />
                    </td>
                    <td className="py-2 text-neutral-500 whitespace-nowrap">
                      {reg ? `₹${reg.price.toLocaleString('en-IN')} / ${reg.durationDays}d` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* Bundles */}
        <section className="bg-white border border-neutral-200 rounded-xl p-5">
          <h2 className="font-semibold text-neutral-900 mb-1">Contact-unlock top-ups</h2>
          <p className="text-xs text-neutral-500 mb-4">
            Keep every bundle priced above the cheapest plan&apos;s per-unlock rate and below the top plan, or buying
            top-ups beats subscribing. Hidden bundles are refused at checkout, not just hidden.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {BUNDLE_KEYS.map((k) => {
              const meta = data?.bundles?.[k];
              const b = form.bundles[k];
              return (
                <div key={k} className="border border-neutral-200 rounded-lg p-3">
                  <p className="font-medium text-neutral-800 text-sm">{meta?.name || k}</p>
                  <p className="text-xs text-neutral-400 mb-2">Regular ₹{meta?.regularPrice?.toLocaleString('en-IN') ?? '—'}</p>
                  <label className="flex items-center gap-2 text-xs text-neutral-600 mb-2">
                    <input type="checkbox" checked={b.hidden} onChange={(e) => setBundleField(k, 'hidden', e.target.checked)} />
                    Withdraw during launch
                  </label>
                  <input type="number" min="1" value={b.price} disabled={b.hidden} onChange={(e) => setBundleField(k, 'price', e.target.value)}
                    className="w-full border border-neutral-200 rounded-lg px-2 py-1.5 text-sm disabled:bg-neutral-100" placeholder="₹" />
                </div>
              );
            })}
          </div>
        </section>

        {/* Founding */}
        <section className="bg-white border border-neutral-200 rounded-xl p-5">
          <h2 className="font-semibold text-neutral-900 mb-1 flex items-center gap-2">
            <Crown className="w-4 h-4 text-gold" /> Founding-member grant
          </h2>
          <p className="text-xs text-neutral-500 mb-4">
            Free premium-grade access granted automatically at signup while the window is open and the cap is not hit.
            Unlocks must be a finite number — blank/unlimited here would let every signup harvest phone numbers.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <label className="flex items-center gap-2 text-neutral-700 col-span-2 md:col-span-1">
              <input type="checkbox" checked={form.founding.enabled} onChange={(e) => setFounding('enabled', e.target.checked)} />
              Enabled
            </label>
            <label className="text-neutral-700">
              Ends at
              <input type="datetime-local" value={form.founding.endsAt} onChange={(e) => setFounding('endsAt', e.target.value)}
                className="mt-1 w-full border border-neutral-200 rounded-lg px-2 py-1.5" />
            </label>
            <label className="text-neutral-700">
              Member cap
              <input type="number" min="0" value={form.founding.memberCap} onChange={(e) => setFounding('memberCap', e.target.value)}
                className="mt-1 w-full border border-neutral-200 rounded-lg px-2 py-1.5" />
            </label>
            <label className="text-neutral-700">
              Grant days
              <input type="number" min="1" max="365" value={form.founding.grantDays} onChange={(e) => setFounding('grantDays', e.target.value)}
                className="mt-1 w-full border border-neutral-200 rounded-lg px-2 py-1.5" />
            </label>
            <label className="text-neutral-700">
              Unlocks
              <input type="number" min="0" max="100" value={form.founding.contactUnlocks} onChange={(e) => setFounding('contactUnlocks', e.target.value)}
                className="mt-1 w-full border border-neutral-200 rounded-lg px-2 py-1.5" />
            </label>
          </div>
          <p className="text-xs text-neutral-400 mt-3">
            {data?.founding?.open
              ? `Currently OPEN · ${data.founding.grantDays} days · ${data.founding.contactUnlocks} unlocks · cap ${data.founding.memberCap || 'none'}`
              : 'Currently CLOSED — no grants are issued at signup.'}
          </p>
        </section>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold disabled:opacity-60">
            <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save pricing'}
          </button>
          <span className="text-xs text-neutral-400">Every save is recorded in the admin audit log.</span>
        </div>
      </form>
    </div>
  );
}
