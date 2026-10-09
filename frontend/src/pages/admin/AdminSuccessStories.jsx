import { useState, useEffect, useRef, forwardRef } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, Eye, EyeOff, Pencil, AlertCircle, RefreshCw } from 'lucide-react';
import apiClient from '../../api/apiClient';

const EMPTY = { coupleNames: '', location: '', marriedOn: '', quote: '', photoUrl: '', tag: '', status: 'draft', displayOrder: 0 };

export default function AdminSuccessStories() {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const firstFieldRef = useRef(null);

  const fetchStories = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/admin/success-stories');
      setStories(res.data.stories || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch stories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStories(); }, []);

  // a11y: Escape closes the dialog; focus the first field when it opens.
  useEffect(() => {
    if (!showModal) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setShowModal(false); };
    window.addEventListener('keydown', onKey);
    const id = window.setTimeout(() => firstFieldRef.current?.focus(), 0);
    return () => { window.removeEventListener('keydown', onKey); window.clearTimeout(id); };
  }, [showModal]);

  const openCreate = () => { setForm(EMPTY); setEditId(null); setSaveError(''); setShowModal(true); };
  const openEdit = (s) => {
    setForm({
      coupleNames: s.coupleNames || '',
      location: s.location || '',
      marriedOn: s.marriedOn ? s.marriedOn.slice(0, 10) : '',
      quote: s.quote || '',
      photoUrl: s.photoUrl || '',
      tag: s.tag || '',
      status: s.status || 'draft',
      displayOrder: s.displayOrder || 0,
    });
    setEditId(s.id);
    setSaveError('');
    setShowModal(true);
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editId) {
        await apiClient.put(`/admin/success-stories/${editId}`, form);
      } else {
        await apiClient.post('/admin/success-stories', form);
      }
      setShowModal(false);
      toast.success(form.status === 'published' ? 'Story saved and published' : 'Story saved as a draft');
      fetchStories();
    } catch (err) {
      setSaveError(err.response?.data?.error?.message || err.response?.data?.message || 'Save failed');
    }
  };

  const togglePublish = async (s) => {
    const publishing = s.status !== 'published';
    try {
      await apiClient.put(`/admin/success-stories/${s.id}`, { status: publishing ? 'published' : 'draft' });
      toast.success(publishing ? 'Published on the website' : 'Taken off the website');
      fetchStories();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || err.response?.data?.message || 'Could not change the story');
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this story?')) return;
    try {
      await apiClient.delete(`/admin/success-stories/${id}`);
      toast.success('Story deleted');
      fetchStories();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || err.response?.data?.message || 'Could not delete the story');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Success Stories</h1>
        <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
          <Plus className="w-4 h-4" /> New Story
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-14 bg-neutral-100 rounded animate-pulse" />)}
        </div>
      ) : error ? (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <AlertCircle className="w-8 h-8 mx-auto mb-3 text-red-500" />
          <p className="text-gray-700 mb-4">{error}</p>
          <button onClick={fetchStories} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm text-left text-gray-700">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Couple</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {stories.map((s) => (
                <tr key={s.id} className="border-t border-gray-200 hover:bg-gray-50">
                  <td className="px-4 py-3">{s.displayOrder}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{s.coupleNames}</td>
                  <td className="px-4 py-3">{s.location || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => togglePublish(s)} title={s.status === 'published' ? 'Unpublish' : 'Publish'} aria-label={s.status === 'published' ? 'Unpublish story' : 'Publish story'} className="text-gray-400 hover:text-gray-700">
                        {s.status === 'published' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button onClick={() => openEdit(s)} title="Edit" aria-label="Edit story" className="text-gray-400 hover:text-gray-700"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => remove(s.id)} title="Delete" aria-label="Delete story" className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {stories.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-500">No stories yet. Create one to feature on the public page.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <form
            onSubmit={save}
            role="dialog"
            aria-modal="true"
            aria-labelledby="story-modal-title"
            className="bg-white rounded-xl p-6 w-full max-w-lg space-y-3 max-h-[90vh] overflow-y-auto shadow-xl"
          >
            <h2 id="story-modal-title" className="text-lg font-semibold text-gray-900 mb-2">{editId ? 'Edit' : 'New'} Story</h2>
            {saveError && (
              <p className="flex items-center gap-2 text-sm text-red-600"><AlertCircle className="w-4 h-4" /> {saveError}</p>
            )}
            <Field ref={firstFieldRef} label="Couple names *" value={form.coupleNames} onChange={(v) => setForm({ ...form, coupleNames: v })} required />
            <Field label="Location" value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
            <Field label="Married on" type="date" value={form.marriedOn} onChange={(v) => setForm({ ...form, marriedOn: v })} />
            <div>
              <label htmlFor="story-quote" className="block text-sm text-gray-600 mb-1">Quote *</label>
              <textarea
                id="story-quote"
                value={form.quote}
                onChange={(e) => setForm({ ...form, quote: e.target.value })}
                required
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900"
              />
            </div>
            <Field label="Photo URL" value={form.photoUrl} onChange={(v) => setForm({ ...form, photoUrl: v })} />
            <Field label="Tag" value={form.tag} onChange={(v) => setForm({ ...form, tag: v })} />
            <Field label="Display order" type="number" value={form.displayOrder} onChange={(v) => setForm({ ...form, displayOrder: v })} />
            <div>
              <label htmlFor="story-status" className="block text-sm text-gray-600 mb-1">Status</label>
              <select id="story-status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 hover:text-gray-900">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

const Field = forwardRef(function Field({ label, value, onChange, type = 'text', required = false }, ref) {
  const id = `story-${label.replace(/[^a-z]/gi, '').toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm text-gray-600 mb-1">{label}</label>
      <input
        ref={ref}
        id={id}
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900"
      />
    </div>
  );
});
