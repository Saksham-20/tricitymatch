import { useState, useEffect } from 'react';
import { Plus, Trash2, Eye, EyeOff, Pencil } from 'lucide-react';
import apiClient from '../../api/apiClient';

const EMPTY = { coupleNames: '', location: '', marriedOn: '', quote: '', photoUrl: '', tag: '', status: 'draft', displayOrder: 0 };

export default function AdminSuccessStories() {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');

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

  const openCreate = () => { setForm(EMPTY); setEditId(null); setShowModal(true); };
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
      fetchStories();
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed');
    }
  };

  const togglePublish = async (s) => {
    await apiClient.put(`/admin/success-stories/${s.id}`, { status: s.status === 'published' ? 'draft' : 'published' });
    fetchStories();
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this story?')) return;
    await apiClient.delete(`/admin/success-stories/${id}`);
    fetchStories();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-white">Success Stories</h1>
        <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700">
          <Plus className="w-4 h-4" /> New Story
        </button>
      </div>

      {error && <p className="mb-4 text-red-400">{error}</p>}

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="w-full text-sm text-left text-gray-300">
            <thead className="bg-gray-800 text-gray-400">
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
                <tr key={s.id} className="border-t border-gray-700">
                  <td className="px-4 py-3">{s.displayOrder}</td>
                  <td className="px-4 py-3 font-medium text-white">{s.coupleNames}</td>
                  <td className="px-4 py-3">{s.location || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${s.status === 'published' ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => togglePublish(s)} title="Toggle publish" className="text-gray-400 hover:text-white">
                        {s.status === 'published' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button onClick={() => openEdit(s)} title="Edit" className="text-gray-400 hover:text-white"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => remove(s.id)} title="Delete" className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {stories.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No stories yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <form onSubmit={save} className="bg-gray-800 rounded-xl p-6 w-full max-w-lg space-y-3 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-white mb-2">{editId ? 'Edit' : 'New'} Story</h2>
            <Field label="Couple names *" value={form.coupleNames} onChange={(v) => setForm({ ...form, coupleNames: v })} required />
            <Field label="Location" value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
            <Field label="Married on" type="date" value={form.marriedOn} onChange={(v) => setForm({ ...form, marriedOn: v })} />
            <div>
              <label className="block text-sm text-gray-400 mb-1">Quote *</label>
              <textarea
                value={form.quote}
                onChange={(e) => setForm({ ...form, quote: e.target.value })}
                required
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-white"
              />
            </div>
            <Field label="Photo URL" value={form.photoUrl} onChange={(v) => setForm({ ...form, photoUrl: v })} />
            <Field label="Tag" value={form.tag} onChange={(v) => setForm({ ...form, tag: v })} />
            <Field label="Display order" type="number" value={form.displayOrder} onChange={(v) => setForm({ ...form, displayOrder: v })} />
            <div>
              <label className="block text-sm text-gray-400 mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-white">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-300 hover:text-white">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700">Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required = false }) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-white"
      />
    </div>
  );
}
