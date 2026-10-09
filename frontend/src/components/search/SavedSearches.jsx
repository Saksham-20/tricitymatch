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
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';

// Search-page filter state → the saved shape the backend + alert job read.
// EVERY filter on screen is saved (empty ones dropped), so opening the saved
// search reproduces what was applied. City is stored as a list.
const NUMERIC = new Set(['ageMin', 'ageMax', 'heightMin', 'heightMax', 'incomeMin', 'incomeMax']);
const toSavedFilters = (filters) => {
  const out = {};
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === '' || value === null || value === undefined) return;
    if (key === 'city') out.city = [value];
    else if (NUMERIC.has(key)) out[key] = parseInt(value, 10);
    else out[key] = value;
  });
  return out;
};

const SavedSearches = ({ filters, onApplySaved }) => {
  const { t } = useTranslation();
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
      const n = Object.keys(res.data.savedSearch?.filters || {}).length;
      toast.success(t('search.saved.savedToast', { count: n }));
    } catch (err) {
      toast.error(err.response?.data?.error?.message || t('search.saved.saveError'));
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
      toast.error(t('search.saved.deleteError'));
    }
  };

  if (state === 'loading') return null;

  return (
    <div className="mb-4 pb-4 border-b border-neutral-100">
      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <FiBookmark className="w-3.5 h-3.5 text-primary-400" /> {t('search.saved.heading')}
      </p>

      {state === 'error' && (
        <button onClick={load} className="text-xs text-neutral-400 hover:text-primary-500 underline">
          {t('search.saved.loadError')}
        </button>
      )}

      {state === 'ready' && items.length === 0 && !currentSavable && (
        <p className="text-xs text-neutral-400">
          {t('search.saved.hint')}
        </p>
      )}

      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {items.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-primary-50 border border-primary-100 text-xs">
              <button onClick={() => onApplySaved(s.filters)} className="font-medium text-primary-700 hover:text-primary-800">
                {s.name}
              </button>
              <button onClick={() => remove(s.id)} aria-label={t('search.saved.deleteAria', { name: s.name })} className="w-7 h-7 -my-1 flex items-center justify-center rounded-full hover:bg-primary-100 text-primary-500 hover:text-primary-700">
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
              placeholder={t('search.saved.namePlaceholder')}
              aria-label={t('search.saved.nameAria')}
              autoFocus
              className="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-neutral-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
            <button onClick={save} disabled={saving || !name.trim()} className="px-3 py-1.5 rounded-lg bg-primary-500 text-white text-xs font-semibold disabled:opacity-50">
              {saving ? '…' : t('common.save')}
            </button>
          </div>
        ) : (
          <button onClick={() => setNaming(true)} className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-800">
            <FiBell className="w-3.5 h-3.5" /> {t('search.saved.saveAndAlert')}
          </button>
        )
      )}
    </div>
  );
};

export default SavedSearches;
