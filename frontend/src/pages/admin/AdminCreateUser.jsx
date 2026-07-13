import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUser } from '../../api/adminApi';
import toast from 'react-hot-toast';
import { FiArrowLeft } from 'react-icons/fi';

// Match the backend: createUser hardcodes role='user' (admins are never created
// through this form — it ignores any role in the body) and coerces status to one
// of active/pending/inactive. The old ['user','admin'] role picker and the
// 'suspended' status were both silently dropped server-side, so they lied to the
// admin. Show only what actually takes effect.
const STATUSES = ['active', 'inactive', 'pending'];

// Defined at module scope — NOT inside the component. A component defined inside
// the render body is a brand-new type on every render, so React unmounts and
// remounts every input on each keystroke, which drops focus after one character
// and made the form nearly impossible to type in.
const Field = ({ label, name, type = 'text', required = false, form, set, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
    {children || (
      <input
        type={type}
        value={form[name]}
        onChange={(e) => set(name, e.target.value)}
        required={required}
        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
    )}
  </div>
);

export default function AdminCreateUser() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    role: 'user',
    status: 'active',
  });
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createUser(form);
      toast.success('User created successfully');
      navigate('/admin/users');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl space-y-5">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 transition-colors"
      >
        <FiArrowLeft className="w-4 h-4" /> Back
      </button>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Create User</h1>
        <p className="text-gray-500 text-sm mt-0.5">Add a new user to the platform</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="First Name" name="firstName" required form={form} set={set} />
          <Field label="Last Name"  name="lastName"  required form={form} set={set} />
        </div>
        <Field label="Email Address" name="email" type="email" required form={form} set={set} />
        <Field label="Phone Number"  name="phone" type="tel" form={form} set={set} />
        <Field label="Password" name="password" type="password" required form={form} set={set}>
          <input
            type="password"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            required
            minLength={8}
            placeholder="Min. 8 characters"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </Field>

        <Field label="Status" name="status">
          <select
            value={form.status}
            onChange={(e) => set('status', e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
          </select>
        </Field>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-primary-700 hover:bg-primary-600 disabled:opacity-60 text-white text-sm font-medium transition-colors"
          >
            {loading ? 'Creating…' : 'Create User'}
          </button>
        </div>
      </form>
    </div>
  );
}
