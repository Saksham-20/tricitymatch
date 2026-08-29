import { useState, useEffect } from 'react';
import { Wallet, Check } from 'lucide-react';
import apiClient from '../../api/apiClient';

/**
 * The commission rate reps earn on what their referred members actually pay.
 * One global lever; the same number the reps see broken down on their own
 * dashboards, so an edit here changes both sides at once.
 */
export default function CommissionSettingsCard() {
  const [rate, setRate] = useState('');
  const [savedRate, setSavedRate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get('/admin/marketing-commission');
        setRate(String(res.data.commission.rate));
        setSavedRate(res.data.commission.rate);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load commission settings');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await apiClient.put('/admin/marketing-commission', { rate: Number(rate) });
      setSavedRate(res.data.commission.rate);
      setRate(String(res.data.commission.rate));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save commission');
    } finally {
      setSaving(false);
    }
  };

  const dirty = savedRate !== null && String(savedRate) !== String(rate);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold-100 text-gold-700 flex items-center justify-center">
            <Wallet size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Commission</h2>
            <p className="text-sm text-gray-600">
              Share of collected revenue each rep earns. Applies to every rep, and shows on their dashboard.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={rate}
              disabled={loading}
              onChange={(e) => setRate(e.target.value)}
              className="w-28 pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-right font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">%</span>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || loading || !dirty}
            className="px-4 py-2 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm font-medium text-green-700">
              <Check size={16} /> Saved
            </span>
          )}
        </div>
      </div>

      {savedRate !== null && (
        <p className="text-xs text-gray-500 mt-3">
          At {savedRate}%, a ₹1,100 plan pays the rep ₹{Math.round((1100 * savedRate) / 100).toLocaleString('en-IN')}.
        </p>
      )}
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </div>
  );
}
