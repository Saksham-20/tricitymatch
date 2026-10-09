import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { FiPlus, FiShield, FiSearch, FiTrash2, FiSave, FiX } from 'react-icons/fi';
import { getAdmins, createAdmin, updateUserRole, getUsers } from '../../api/adminApi';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/formatDate';

/**
 * Admins & Roles.
 *
 * Two ways in, because they are genuinely different jobs:
 *  · create a NEW admin account (a person who was never a member), and
 *  · promote an EXISTING personal account (the common case — the owner's own
 *    member profile, a colleague who already signed up).
 *
 * Permission checkboxes only apply to `sub_admin`: `admin`/`super_admin` hold
 * every scope implicitly, so rendering an editable list for them would imply a
 * stored set that does not exist. The server re-checks every rule here — this
 * screen hides what it would refuse, it does not decide it.
 */

const ROLE_COPY = {
  sub_admin:   'Limited admin: only the permissions you tick below',
  admin:       'Full admin: every panel, including pricing and payouts',
  super_admin: 'Full admin, and may also manage other admins',
};

const RoleBadge = ({ role }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
    role === 'super_admin' ? 'bg-primary-100 text-primary-700'
      : 'bg-gray-100 text-gray-600'
  }`}>
    {String(role).replace(/_/g, ' ')}
  </span>
);

export default function AdminTeam() {
  const { user: me } = useAuth();
  const [admins, setAdmins]   = useState([]);
  const [scopes, setScopes]   = useState({});
  const [grantableRoles, setGrantableRoles] = useState([]);
  const [grantableScopes, setGrantableScopes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [editing, setEditing] = useState(null); // admin row being re-scoped
  const [confirmRevoke, setConfirmRevoke] = useState(null); // admin row pending revoke confirmation
  const [busy, setBusy]       = useState(false);

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdmins();
      setAdmins(res.data.admins || []);
      setScopes(res.data.scopes || {});
      setGrantableRoles(res.data.grantableRoles || []);
      setGrantableScopes(res.data.grantableScopes || []);
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Failed to load admins');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAdmins(); }, [fetchAdmins]);

  const apiError = (err, fallback) => {
    const e = err?.response?.data?.error;
    toast.error(e?.details?.[0]?.message ? `${e.message}: ${e.details[0].message}` : (e?.message || fallback));
  };

  const saveScopes = async (row, role, permissions) => {
    setBusy(true);
    try {
      await updateUserRole(row.id, { role, permissions });
      toast.success('Permissions updated');
      setEditing(null);
      fetchAdmins();
    } catch (err) {
      apiError(err, 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (row) => {
    // Irreversible from this screen for the person on the other end: they lose
    // the panel on their next request. Confirmed in a branded dialog before,
    // not a toast after.
    setBusy(true);
    try {
      await updateUserRole(row.id, { role: 'user' });
      toast.success('Admin access removed');
      setConfirmRevoke(null);
      fetchAdmins();
    } catch (err) {
      apiError(err, 'Could not remove access');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-5" aria-busy="true">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <div className="skeleton h-7 w-48 rounded-lg" />
            <div className="skeleton h-4 w-80 max-w-full rounded" />
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="px-4 py-4 flex items-center gap-4">
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-40 rounded" />
                <div className="skeleton h-3 w-56 max-w-full rounded" />
              </div>
              <div className="skeleton h-6 w-20 rounded-full" />
              <div className="skeleton h-9 w-24 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-gray-100 text-center">
        <p className="text-sm text-gray-600 mb-3">{error}</p>
        <button onClick={fetchAdmins} className="px-4 py-2 rounded-xl bg-primary-700 text-white text-sm font-medium">Retry</button>
      </div>
    );
  }

  const scopeKeys = Object.keys(scopes);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admins &amp; Roles</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Who can open this panel, and how much of it. Permissions are enforced on the server.
            Hiding a page is not the same as blocking it, and both happen here.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPromoteOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium"
          >
            <FiShield className="w-4 h-4" /> Promote existing account
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-700 hover:bg-primary-600 text-white text-sm font-medium"
          >
            <FiPlus className="w-4 h-4" /> New admin
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Person</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Permissions</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Last login</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {admins.map((a) => {
                const isMe = a.id === me?.id;
                return (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">
                        {[a.firstName, a.lastName].filter(Boolean).join(' ') || '—'}
                        {isMe && <span className="ml-2 text-xs text-gray-400">(you)</span>}
                      </p>
                      <p className="text-xs text-gray-400">{a.email}</p>
                    </td>
                    <td className="px-4 py-3"><RoleBadge role={a.role} /></td>
                    <td className="px-4 py-3">
                      {a.fullAccess ? (
                        <span className="text-xs text-gray-500">All permissions</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {a.permissions.map((p) => (
                            <span key={p} className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-xs">{p}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {a.lastLogin ? formatDate(a.lastLogin) : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isMe ? (
                        // Self-edit is refused server-side too: it is the shape of
                        // both accidental lockout and quiet self-escalation.
                        <span className="text-xs text-gray-400">Ask another admin</span>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setEditing({ ...a, draftRole: a.role, draftScopes: a.permissions })}
                            className="inline-flex items-center min-h-[44px] px-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium"
                          >
                            Edit access
                          </button>
                          <button
                            onClick={() => setConfirmRevoke(a)}
                            disabled={busy}
                            className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg bg-red-50 hover:bg-red-100 text-red-600 disabled:opacity-50"
                            aria-label={`Remove admin access for ${a.email}`}
                            title="Remove admin access"
                          >
                            <FiTrash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {createOpen && (
        <AdminForm
          title="New admin account"
          scopes={scopes}
          scopeKeys={scopeKeys}
          grantableRoles={grantableRoles}
          grantableScopes={grantableScopes}
          onClose={() => setCreateOpen(false)}
          onSubmit={async (payload) => {
            setBusy(true);
            try {
              await createAdmin(payload);
              toast.success('Admin account created');
              setCreateOpen(false);
              fetchAdmins();
            } catch (err) {
              apiError(err, 'Could not create admin');
            } finally {
              setBusy(false);
            }
          }}
          busy={busy}
        />
      )}

      {promoteOpen && (
        <PromoteForm
          scopes={scopes}
          scopeKeys={scopeKeys}
          grantableRoles={grantableRoles}
          grantableScopes={grantableScopes}
          onClose={() => setPromoteOpen(false)}
          onSubmit={async (userId, role, permissions) => {
            setBusy(true);
            try {
              await updateUserRole(userId, { role, permissions });
              toast.success('Admin access granted');
              setPromoteOpen(false);
              fetchAdmins();
            } catch (err) {
              apiError(err, 'Could not grant access');
            } finally {
              setBusy(false);
            }
          }}
          busy={busy}
        />
      )}

      {editing && (
        <Modal title={`Access for ${editing.email}`} onClose={() => setEditing(null)}>
          <RolePicker
            role={editing.draftRole}
            onRole={(r) => setEditing((e) => ({ ...e, draftRole: r }))}
            grantableRoles={grantableRoles}
          />
          {editing.draftRole === 'sub_admin' && (
            <ScopePicker
              scopes={scopes}
              scopeKeys={scopeKeys}
              grantableScopes={grantableScopes}
              selected={editing.draftScopes}
              onChange={(next) => setEditing((e) => ({ ...e, draftScopes: next }))}
            />
          )}
          <div className="flex gap-3 mt-5">
            <button onClick={() => setEditing(null)} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium">Cancel</button>
            <button
              onClick={() => saveScopes(editing, editing.draftRole, editing.draftScopes)}
              disabled={busy}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary-700 text-white text-sm font-medium disabled:opacity-60"
            >
              <FiSave className="w-4 h-4" /> Save
            </button>
          </div>
        </Modal>
      )}

      {confirmRevoke && (
        <Modal title="Remove admin access" onClose={() => setConfirmRevoke(null)}>
          <p className="text-sm text-gray-600">
            Remove admin access for <span className="font-medium text-gray-800">{confirmRevoke.email}</span>?
            They keep their member account and lose the panel on their next request.
          </p>
          <div className="flex gap-3 mt-5">
            <button onClick={() => setConfirmRevoke(null)} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium">Cancel</button>
            <button
              onClick={() => revoke(confirmRevoke)}
              disabled={busy}
              className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium disabled:opacity-60"
            >
              Remove access
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ── pieces ─────────────────────────────────────────────────────────────── */

function Modal({ title, onClose, children }) {
  const titleId = useId();
  const cardRef = useRef(null);
  // Keep the effect mount-only: parents pass a fresh onClose each render, so a
  // dependency on it would re-run the effect and yank focus back to the first
  // field every time the dialog's own form state changes.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const card = cardRef.current;
    const focusables = () => (card
      ? Array.from(card.querySelectorAll(
          'a[href], button:not([disabled]), textarea, input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      : []);
    // Move focus into the dialog on open.
    (focusables()[0] || card)?.focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onCloseRef.current(); return; }
      if (e.key === 'Tab') {
        const items = focusables();
        if (items.length === 0) { e.preventDefault(); return; }
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      // Restore focus to whatever opened the dialog.
      if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={() => onClose()}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto focus:outline-none"
      >
        <div className="flex items-start justify-between mb-4">
          <h3 id={titleId} className="text-lg font-bold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg hover:bg-gray-100 text-gray-400"
          >
            <FiX className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function RolePicker({ role, onRole, grantableRoles }) {
  return (
    <div className="space-y-2 mb-4">
      {grantableRoles.map((r) => (
        <label key={r} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer ${
          role === r ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'
        }`}>
          <input type="radio" name="role" checked={role === r} onChange={() => onRole(r)} className="mt-0.5" />
          <span>
            <span className="block text-sm font-medium text-gray-800 capitalize">{r.replace(/_/g, ' ')}</span>
            <span className="block text-xs text-gray-500">{ROLE_COPY[r]}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

function ScopePicker({ scopes, scopeKeys, grantableScopes, selected, onChange }) {
  const toggle = (key) => {
    onChange(selected.includes(key) ? selected.filter((s) => s !== key) : [...selected, key]);
  };
  return (
    <div className="border border-gray-200 rounded-xl p-3 space-y-1.5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Permissions</p>
      {scopeKeys.map((key) => {
        const allowed = grantableScopes.includes(key);
        return (
          <label key={key} className={`flex items-start gap-2.5 py-1 ${allowed ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}>
            <input
              type="checkbox"
              className="mt-1"
              disabled={!allowed}
              checked={selected.includes(key)}
              onChange={() => allowed && toggle(key)}
            />
            <span>
              <span className="block text-sm text-gray-800 capitalize">{key}</span>
              <span className="block text-xs text-gray-500">{scopes[key]}</span>
            </span>
          </label>
        );
      })}
      {/* You cannot hand out what you do not hold — the server refuses it too,
          so the greyed rows are the same rule stated twice. */}
      {scopeKeys.some((k) => !grantableScopes.includes(k)) && (
        <p className="text-xs text-gray-400 pt-1">Greyed permissions are ones your own account does not hold.</p>
      )}
    </div>
  );
}

function AdminForm({ title, scopes, scopeKeys, grantableRoles, grantableScopes, onClose, onSubmit, busy }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '' });
  const [role, setRole] = useState(grantableRoles.includes('sub_admin') ? 'sub_admin' : grantableRoles[0]);
  const [permissions, setPermissions] = useState(
    ['users', 'verifications', 'reports', 'support'].filter((s) => grantableScopes.includes(s))
  );
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal title={title} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <input value={form.firstName} onChange={set('firstName')} aria-label="First name (required)" required aria-required="true" placeholder="First name *" className="px-3 py-2.5 border border-gray-200 rounded-xl text-base" />
        <input value={form.lastName} onChange={set('lastName')} aria-label="Last name" placeholder="Last name" className="px-3 py-2.5 border border-gray-200 rounded-xl text-base" />
        <input value={form.email} onChange={set('email')} aria-label="Email (required)" required aria-required="true" placeholder="Email *" type="email" className="col-span-2 px-3 py-2.5 border border-gray-200 rounded-xl text-base" />
        <input value={form.phone} onChange={set('phone')} aria-label="Phone" placeholder="Phone" className="px-3 py-2.5 border border-gray-200 rounded-xl text-base" />
        <input value={form.password} onChange={set('password')} aria-label="Temporary password (required)" required aria-required="true" placeholder="Temporary password * (8+ characters, upper, lower, number, symbol)" type="text" className="px-3 py-2.5 border border-gray-200 rounded-xl text-base" />
      </div>
      <p className="text-xs text-gray-400 -mt-2 mb-4">
        Share the password with them directly. Nothing is emailed, and they can change it from Settings.
      </p>

      <RolePicker role={role} onRole={setRole} grantableRoles={grantableRoles} />
      {role === 'sub_admin' && (
        <ScopePicker scopes={scopes} scopeKeys={scopeKeys} grantableScopes={grantableScopes} selected={permissions} onChange={setPermissions} />
      )}

      <div className="flex gap-3 mt-5">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium">Cancel</button>
        <button
          onClick={() => onSubmit({ ...form, role, permissions })}
          disabled={busy || !form.email || !form.password || !form.firstName}
          className="flex-1 py-2.5 rounded-xl bg-primary-700 text-white text-sm font-medium disabled:opacity-60"
        >
          Create admin
        </button>
      </div>
    </Modal>
  );
}

function PromoteForm({ scopes, scopeKeys, grantableRoles, grantableScopes, onClose, onSubmit, busy }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState(null);
  const [role, setRole] = useState(grantableRoles.includes('sub_admin') ? 'sub_admin' : grantableRoles[0]);
  const [permissions, setPermissions] = useState(
    ['users', 'verifications', 'reports', 'support'].filter((s) => grantableScopes.includes(s))
  );

  const search = async () => {
    if (query.trim().length < 3) { toast.error('Type at least 3 characters of the email or phone'); return; }
    setSearching(true);
    try {
      const res = await getUsers({ search: query.trim(), limit: 10 });
      setResults(res.data.users || []);
    } catch {
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  return (
    <Modal title="Promote an existing account" onClose={onClose}>
      <p className="text-sm text-gray-500 mb-3">
        Find the person by email or phone. Their member profile stays exactly as it is. They simply
        gain the panel.
      </p>
      <div className="flex gap-2 mb-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          aria-label="Search by email or phone"
          placeholder="Email or phone"
          className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-base"
        />
        <button onClick={search} disabled={searching} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium disabled:opacity-60">
          <FiSearch className="w-4 h-4" /> Search
        </button>
      </div>

      {results.length > 0 && (
        <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 mb-4 max-h-48 overflow-y-auto">
          {results.map((u) => (
            <button
              key={u.id}
              onClick={() => setPicked(u)}
              className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${picked?.id === u.id ? 'bg-primary-50' : ''}`}
            >
              <p className="text-sm text-gray-800">
                {[u.Profile?.firstName, u.Profile?.lastName].filter(Boolean).join(' ') || '—'}
                <span className="ml-2 text-xs text-gray-400">{u.email || u.phone}</span>
              </p>
              <p className="text-xs text-gray-400">Currently: {String(u.role).replace(/_/g, ' ')}</p>
            </button>
          ))}
        </div>
      )}

      {picked && (
        <>
          <div className="mb-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
            <p className="text-sm text-gray-800">{picked.email || picked.phone}</p>
          </div>
          <RolePicker role={role} onRole={setRole} grantableRoles={grantableRoles} />
          {role === 'sub_admin' && (
            <ScopePicker scopes={scopes} scopeKeys={scopeKeys} grantableScopes={grantableScopes} selected={permissions} onChange={setPermissions} />
          )}
        </>
      )}

      <div className="flex gap-3 mt-5">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium">Cancel</button>
        <button
          onClick={() => onSubmit(picked.id, role, permissions)}
          disabled={busy || !picked}
          className="flex-1 py-2.5 rounded-xl bg-primary-700 text-white text-sm font-medium disabled:opacity-60"
        >
          Grant access
        </button>
      </div>
    </Modal>
  );
}
