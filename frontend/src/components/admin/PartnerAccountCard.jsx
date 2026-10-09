import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { FiEdit2, FiKey, FiMail, FiRefreshCw, FiCopy, FiCheck } from 'react-icons/fi';
import { updateMarketingUser, resetMarketingUserPassword, resendPartnerWelcome } from '../../api/adminApi';
import copyText from '../../utils/copyText';
import generatePassword from '../../utils/generatePassword';
import { formatLeadPhone } from '../../utils/leadContact';

/**
 * Looking after a partner's account once it exists: correct a typo'd email or
 * phone, set a new password when they are locked out (their own reset email goes
 * to the same address, so a wrong address cannot rescue itself), and send the
 * welcome note again.
 *
 * A password set here is shown once, in a panel the admin copies from, and is
 * never stored or emailed. Setting it signs the partner out everywhere.
 */

const input = 'w-full border border-gray-300 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';
const label = 'block text-sm font-medium text-gray-700 mb-1';

const errorOf = (err, fallback) =>
  err?.response?.data?.error?.details?.[0]?.message
  || err?.response?.data?.error?.message
  || err?.response?.data?.message
  || fallback;

function Dialog({ titleId, title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white p-6 rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-xl font-bold mb-4">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export default function PartnerAccountCard({ user, onChanged }) {
  const [dialog, setDialog] = useState(null); // 'edit' | 'password' | null
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [password, setPassword] = useState('');
  const [shown, setShown] = useState(false);
  const [issued, setIssued] = useState(null); // { password } after a successful reset
  const [copied, setCopied] = useState(false);

  const close = () => { setDialog(null); setError(''); setIssued(null); setPassword(''); setShown(false); };

  const openEdit = () => {
    setForm({
      firstName: user.Profile?.firstName || '',
      lastName: user.Profile?.lastName || '',
      email: user.email || '',
      phone: user.phone || '',
    });
    setError('');
    setDialog('edit');
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await updateMarketingUser(user.id, form);
      toast.success('Partner details updated');
      close();
      onChanged?.();
    } catch (err) {
      setError(errorOf(err, 'Could not update the partner'));
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await resetMarketingUserPassword(user.id, password);
      setIssued({ password });
      setPassword('');
    } catch (err) {
      setError(errorOf(err, 'Could not set the password'));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    try {
      const res = await resendPartnerWelcome(user.id);
      if (res.data?.welcomeEmailSent) toast.success(`Welcome email sent to ${user.email}`);
      else toast.error('The email could not be sent. Check the address and try again.');
    } catch (err) {
      toast.error(errorOf(err, 'Could not send the email'));
    } finally {
      setBusy(false);
    }
  };

  const signInText = (pw) =>
    `Your TricityMatch partner password has been reset.\n\nSign in: ${window.location.origin}/login\nEmail: ${user.email}\nNew password: ${pw}\n\nPlease change it after you sign in (Account & security in the portal).`;

  const copyIssued = async () => {
    if (await copyText(signInText(issued.password))) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const btn = 'inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg border border-gray-300 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50';

  return (
    <section aria-label="Partner account" className="mb-8 bg-white border border-gray-200 rounded-2xl p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-1">Account</h2>
      <p className="text-sm text-gray-600 mb-4">
        {user.email}{user.phone ? ` · ${formatLeadPhone(user.phone)}` : ''}. Their own password-reset email goes to this address, so fix it here if it is wrong.
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="button" className={btn} onClick={openEdit}><FiEdit2 size={14} aria-hidden="true" /> Edit details</button>
        <button type="button" className={btn} onClick={() => { setPassword(''); setIssued(null); setError(''); setDialog('password'); }}><FiKey size={14} aria-hidden="true" /> Set new password</button>
        <button type="button" className={btn} onClick={resend} disabled={busy}><FiMail size={14} aria-hidden="true" /> Resend welcome email</button>
      </div>

      {dialog === 'edit' && (
        <Dialog titleId="edit-partner-title" title="Edit partner details" onClose={close}>
          {error && <div role="alert" className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-sm">{error}</div>}
          <form onSubmit={saveEdit} className="space-y-4">
            <div><label htmlFor="ep-first" className={label}>First name</label><input id="ep-first" className={input} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required /></div>
            <div><label htmlFor="ep-last" className={label}>Last name</label><input id="ep-last" className={input} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required /></div>
            <div><label htmlFor="ep-email" className={label}>Email</label><input id="ep-email" type="email" className={input} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
            <div><label htmlFor="ep-phone" className={label}>Mobile number <span className="text-gray-500 font-normal">(optional)</span></label><input id="ep-phone" type="tel" className={input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className="flex-1 min-h-[44px] bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
              <button type="button" onClick={close} className="flex-1 min-h-[44px] border rounded-lg hover:bg-gray-50">Cancel</button>
            </div>
          </form>
        </Dialog>
      )}

      {dialog === 'password' && (
        <Dialog titleId="reset-partner-title" title={issued ? 'New password set' : 'Set a new password'} onClose={close}>
          {issued ? (
            <>
              <p className="text-sm text-gray-700 mb-2">They have been signed out everywhere. Send them this now; the password cannot be shown again.</p>
              <pre className="whitespace-pre-wrap break-all rounded bg-gray-50 border p-3 text-sm text-gray-900">{signInText(issued.password)}</pre>
              <div className="flex gap-2 mt-4">
                <button type="button" onClick={copyIssued} className="flex-1 inline-flex items-center justify-center gap-2 min-h-[44px] bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                  {copied ? <FiCheck size={16} aria-hidden="true" /> : <FiCopy size={16} aria-hidden="true" />}{copied ? 'Copied' : 'Copy'}
                </button>
                <button type="button" onClick={close} className="flex-1 min-h-[44px] border rounded-lg hover:bg-gray-50">Done</button>
              </div>
            </>
          ) : (
            <>
              {error && <div role="alert" className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-sm">{error}</div>}
              <p className="text-sm text-gray-600 mb-3">Signs {user.email} out of every device. They should change it after signing in.</p>
              <form onSubmit={savePassword} className="space-y-4">
                <div>
                  <label htmlFor="rp-password" className={label}>New password</label>
                  <div className="flex gap-2">
                    <input id="rp-password" type={shown ? 'text' : 'password'} minLength={8} autoComplete="new-password" className={input} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8+ characters, upper, lower, number, symbol" required />
                    <button type="button" onClick={() => { setPassword(generatePassword()); setShown(true); }} className="inline-flex items-center gap-1.5 whitespace-nowrap border px-3 rounded-lg text-sm font-medium hover:bg-gray-50 min-h-[44px]">
                      <FiRefreshCw size={14} aria-hidden="true" /> Generate
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={busy} className="flex-1 min-h-[44px] bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">{busy ? 'Saving…' : 'Set password'}</button>
                  <button type="button" onClick={close} className="flex-1 min-h-[44px] border rounded-lg hover:bg-gray-50">Cancel</button>
                </div>
              </form>
            </>
          )}
        </Dialog>
      )}
    </section>
  );
}
