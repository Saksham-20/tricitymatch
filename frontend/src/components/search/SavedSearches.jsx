/**
 * SavedSearches — Phase A step 6 UI. Lists the member's saved searches (cap 5,
 * stored server-side where the daily alert job reads them), applies one on
 * tap, deletes inline, and saves the current filter set under a name.
 *
 * DS8 states: loading (quiet), empty (hint line), fetch-fail (retry line),
 * ready (chips).
 */

import { useEffect, useState, useCallback } from 'react';
import { FiBookmark, FiX, FiBell } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../../api/axios';

// Search-page filter state → the saved shape the backend + alert job read.
const toSavedFilters = (filters) => {
  const out = {};
  if (filters.religion) out.religion = filters.religion;
  if (filters.caste) out.caste = filters.caste;
  if (filters.city) out.city = [filters.city];
  if (filters.ageMin) out.ageMin = parseInt(filters.ageMin, 10);
  if (filters.ageMax) out.ageMax = parseInt(filters.ageMax, 10);
  return out;
};

const SavedSearches = ({ filters, onApplySaved }) => {
  const [items, setItems] = useState([]);
  const [state, setState] = useState('loading'); // loading | ready | error
  const [saving, setSaving] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.get('/search/saved');
      setItems(res.data.savedSearches || []);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const currentSavable = Object.keys(toSavedFilters(filters)).length > 0;

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const res = await api.post('/search/saved', { name: trimmed, filters: toSavedFilters(filters) });
      setItems((prev) => [...prev, res.data.savedSearch]);
      setNaming(false);
      setName('');
      toast.success('Search saved — we’ll alert you about new matches');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not save search');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    const prev = items;
    setItems((p) => p.filter((s) => s.id !== id));
    try {
      await api.delete(`/search/saved/${id}`);
    } catch {
      setItems(prev);
      toast.error('Could not delete saved search');
    }
  };

  if (state === 'loading') return null;

  return (
    <div className="mb-4 pb-4 border-b border-neutral-100">
      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <FiBookmark className="w-3.5 h-3.5 text-primary-400" /> Saved searches
      </p>

      {state === 'error' && (
        <button onClick={load} className="text-xs text-neutral-400 hover:text-primary-500 underline">
          Couldn&apos;t load — retry
        </button>
      )}

      {state === 'ready' && items.length === 0 && !currentSavable && (
        <p className="text-xs text-neutral-400">
          Set some filters, save the search, and we&apos;ll notify you when new profiles match.
        </p>
      )}

      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {items.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-primary-50 border border-primary-100 text-xs">
              <button onClick={() => onApplySaved(s.filters)} className="font-medium text-primary-700 hover:text-primary-800">
                {s.name}
              </button>
              <button onClick={() => remove(s.id)} aria-label={`Delete saved search ${s.name}`} className="p-0.5 rounded-full hover:bg-primary-100 text-primary-300 hover:text-primary-600">
                <FiX className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {currentSavable && items.length < 5 && (
        naming ? (
          <div className="flex items-center gap-1.5">
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 60))}
              onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setNaming(false); }}
              placeholder="Name this search"
              aria-label="Saved search name"
              autoFocus
              className="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-neutral-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
            <button onClick={save} disabled={saving || !name.trim()} className="px-3 py-1.5 rounded-lg bg-primary-500 text-white text-xs font-semibold disabled:opacity-50">
              {saving ? '…' : 'Save'}
            </button>
          </div>
        ) : (
          <button onClick={() => setNaming(true)} className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-800">
            <FiBell className="w-3.5 h-3.5" /> Save this search &amp; get alerts
          </button>
        )
      )}
    </div>
  );
};

export default SavedSearches;
