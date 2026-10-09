import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getUser, getModerationHistory, updateSubscription, updateVerification, cancelSubscription, refundSubscription, deleteUsers, updateUserStatus, updateUserVisibility, removePhoto, flagPhoto } from '../../api/adminApi';
import { useAdminScopes } from '../../components/admin/AdminLayout';
import usePlanOptions from '../../hooks/usePlanOptions';
import planLabel from '../../utils/planLabel';
import PlanOverrideNotice, { overrideProblem } from '../../components/admin/PlanOverrideNotice';
import toast from 'react-hot-toast';
import RetryImage from '../../components/ui/RetryImage';
import { FiArrowLeft, FiCheckCircle, FiXCircle, FiTrash2, FiSlash, FiFlag, FiImage, FiX, FiRotateCcw, FiShield, FiEye, FiEyeOff, FiUsers } from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import { formatDate, formatDateTime } from '../../utils/formatDate';

const Section = ({ title, children }) => (
  <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
    <h3 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">{title}</h3>
    {children}
  </div>
);

const InfoRow = ({ label, value }) => (
  <div className="flex items-start gap-2 py-1.5">
    <span className="text-xs text-gray-500 w-36 flex-shrink-0">{label}</span>
    <span className="text-sm text-gray-800 font-medium">{value || '—'}</span>
  </div>
);

const HISTORY_LABEL = {
  report_received: 'Report received',
  report_decided: 'Report decided',
  photo_held: 'Photo held',
  photo_decided: 'Photo decision',
  appeal_submitted: 'Appeal',
  appeal_decided: 'Appeal decision',
  staff_action: 'Staff action',
};

// Reports, photo holds, appeals and staff actions in one timeline. Needs the
// `reports` scope; a member of staff without it simply does not see the block.
function ModerationHistory({ userId }) {
  const [history, setHistory] = useState(null);
  useEffect(() => {
    let alive = true;
    getModerationHistory(userId)
      .then((res) => { if (alive) setHistory(res.data); })
      .catch(() => { if (alive) setHistory(null); });
    return () => { alive = false; };
  }, [userId]);

  if (!history || history.timeline.length === 0) return null;
  const { summary, timeline } = history;
  const stats = [
    ['Reports received', summary.reportsReceived],
    ['Resolved', summary.reportsResolved],
    ['Reports filed', summary.reportsFiled],
    ['Photos held', summary.photosHeld],
    ['Appeals', summary.appeals],
  ];
  return (
    <Section title="Moderation History">
      <div className="flex flex-wrap gap-2 mb-3">
        {stats.map(([label, n]) => (
          <span key={label} className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            {label}: {n}
          </span>
        ))}
      </div>
      <ol className="space-y-2">
        {[...timeline].reverse().map((e) => (
          <li key={`${e.kind}-${e.id}-${e.at}`} className="p-3 rounded-xl bg-gray-50 border border-gray-100">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-gray-800">
                {HISTORY_LABEL[e.kind] || e.kind}
                <span className="font-normal text-gray-500"> · {e.summary?.replace(/_/g, ' ')}</span>
              </p>
              <span className="text-xs text-gray-400 flex-shrink-0">{formatDateTime(e.at)}</span>
            </div>
            {(e.byName || e.note) && (
              <p className="text-xs text-gray-500 mt-0.5">
                {e.byName ? `By ${e.byName}` : ''}{e.byName && e.note ? ' — ' : ''}{e.note || ''}
              </p>
            )}
          </li>
        ))}
      </ol>
    </Section>
  );
}

export default function AdminUserDetail() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const canDelete = me?.role === 'admin' || me?.role === 'super_admin';
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [planModal, setPlanModal] = useState(false);
  const [newPlan, setNewPlan]     = useState('');
  const [reason, setReason]       = useState('');
  const [saving, setSaving]       = useState(false);
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling]   = useState(false);
  // Refund: money leaves through Razorpay and cannot be recalled, so it has its
  // own modal that states the amount and needs a reason.
  const [refundTarget, setRefundTarget] = useState(null); // the Subscription row
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refunding, setRefunding]       = useState(false);
  const planPanelRef   = useRef(null);
  const cancelPanelRef = useRef(null);
  const { options: planOptions } = usePlanOptions();

  // Photo-moderation + ban. A full admin (scopes === null) can do everything;
  // a sub-admin needs `reports` to remove/flag a photo and `users` to ban.
  const scopes = useAdminScopes();
  const can = (s) => scopes === null || scopes.includes(s);
  const [photoAction, setPhotoAction] = useState(null); // { type: 'remove' | 'flag', url }
  const [photoReason, setPhotoReason] = useState('');
  const [photoBusy, setPhotoBusy]     = useState(false);
  const [lightbox, setLightbox]       = useState(null);  // url of photo being viewed full-size
  const [failedPhotos, setFailedPhotos] = useState(() => new Set());
  const [statusTarget, setStatusTarget] = useState(null); // 'banned' | 'active' when the ban modal is open
  const [statusReason, setStatusReason] = useState('');
  const [statusBusy, setStatusBusy]     = useState(false);
  // Invisible to members (quiet hide): true = hide, false = show again.
  const [visTarget, setVisTarget] = useState(null);
  const [visReason, setVisReason] = useState('');
  const [visBusy, setVisBusy]     = useState(false);

  const submitPhotoAction = async () => {
    if (!photoAction) return;
    if (photoReason.trim().length < 5) { toast.error('Give a brief reason (at least 5 characters)'); return; }
    setPhotoBusy(true);
    try {
      if (photoAction.type === 'remove') {
        await removePhoto({ userId, photoUrl: photoAction.url, reason: photoReason.trim() });
        toast.success('Photo removed and the member notified');
      } else {
        await flagPhoto({ userId, photoUrl: photoAction.url, reason: photoReason.trim() });
        toast.success('Photo flagged for review');
      }
      setPhotoAction(null); setPhotoReason('');
      fetchUser();
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || err?.response?.data?.message || 'Action failed');
    } finally { setPhotoBusy(false); }
  };

  const submitStatusChange = async () => {
    if (!statusTarget) return;
    if (statusTarget === 'banned' && statusReason.trim().length < 5) { toast.error('Give a brief reason for the ban (at least 5 characters)'); return; }
    setStatusBusy(true);
    try {
      await updateUserStatus(userId, { status: statusTarget, reason: statusReason.trim() });
      toast.success(statusTarget === 'banned' ? 'User banned' : 'User reinstated');
      setStatusTarget(null); setStatusReason('');
      fetchUser();
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || err?.response?.data?.message || 'Action failed');
    } finally { setStatusBusy(false); }
  };

  const submitVisibility = async () => {
    if (visTarget === null) return;
    if (visTarget && visReason.trim().length < 3) { toast.error('Add a short reason so the next admin knows why'); return; }
    setVisBusy(true);
    try {
      await updateUserVisibility(userId, { hidden: visTarget, reason: visReason.trim() });
      toast.success(visTarget ? 'Member is now invisible to other members' : 'Member is visible to other members again');
      setVisTarget(null); setVisReason('');
      fetchUser();
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || err?.response?.data?.message || 'Action failed');
    } finally { setVisBusy(false); }
  };

  const fetchUser = async () => {
    setLoading(true);
    try {
      const res = await getUser(userId);
      setData(res.data);
    } catch {
      toast.error('Failed to load user');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUser(); }, [userId]);

  // Both modals are dialogs: move focus into the panel on open and close on
  // Escape. Without this a keyboard operator got no modal semantics on a
  // money-changing action.
  useEffect(() => {
    if (!planModal && !cancelModal) return undefined;
    const ref = cancelModal ? cancelPanelRef : planPanelRef;
    ref.current?.focus();
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (cancelModal) setCancelModal(false); else setPlanModal(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [planModal, cancelModal]);

  // Escape closes the photo-action / ban / lightbox overlays.
  useEffect(() => {
    if (!photoAction && !statusTarget && !lightbox && visTarget === null) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (lightbox) setLightbox(null);
      else if (photoAction) setPhotoAction(null);
      else if (visTarget !== null) setVisTarget(null);
      else setStatusTarget(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [photoAction, statusTarget, lightbox, visTarget]);

  const handleUpdateSubscription = async () => {
    setSaving(true);
    try {
      await updateSubscription(userId, { planType: newPlan, reason: reason.trim() });
      toast.success('Subscription updated');
      setPlanModal(false);
      setReason('');
      fetchUser();
    } catch (err) {
      // Surface what the server said. A generic "Update failed" is how the
      // stale plan-key bug stayed invisible: the API was answering
      // "planType: Invalid value" and the panel showed nothing useful.
      const e = err?.response?.data?.error;
      toast.error(e?.details?.[0]?.message ? `${e.message}: ${e.details[0].message}` : (e?.message || 'Update failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Permanently delete this account? Profile, photos, messages and matches are removed from the database. This cannot be undone.')) return;
    try {
      const res = await deleteUsers([userId]);
      if (res.data.deleted?.length) {
        toast.success('Account deleted');
        navigate('/admin/users');
      } else {
        toast.error(res.data.blocked?.[0]?.reason || 'Account was not deleted');
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error?.message || 'Delete failed');
    }
  };

  // Ending a member's paid access is consequential and the reason is written to
  // the audit log \u2014 captured in a styled modal, not a pair of browser dialogs.
  const handleCancelPlan = async () => {
    setCancelling(true);
    try {
      await cancelSubscription(userId, { reason: cancelReason.trim() });
      toast.success('Plan cancelled');
      setCancelModal(false);
      setCancelReason('');
      fetchUser();
    } catch (err) {
      const e = err?.response?.data?.error;
      toast.error(e?.message || 'Could not cancel the plan');
    } finally {
      setCancelling(false);
    }
  };

  const openRefund = (row) => {
    const left = Math.max(0, (Number(row.amount) || 0) - (Number(row.refundedAmount) || 0));
    setRefundAmount(String(left));
    setRefundReason('');
    setRefundTarget(row);
  };

  const handleRefund = async () => {
    setRefunding(true);
    try {
      await refundSubscription(refundTarget.id, { amount: Number(refundAmount), reason: refundReason.trim() });
      toast.success('Refund issued. It reaches the member in five to seven working days.');
      setRefundTarget(null);
      fetchUser();
    } catch (err) {
      const e = err?.response?.data?.error;
      toast.error(e?.details?.[0]?.message || e?.message || 'Could not issue the refund');
    } finally {
      setRefunding(false);
    }
  };

  const handleVerification = async (verificationId, action) => {
    try {
      await updateVerification(verificationId, { status: action, adminNotes: '' });
      toast.success(`Verification ${action}`);
      fetchUser();
    } catch {
      toast.error('Action failed');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!data) return <div className="text-center text-gray-500 py-20">User not found</div>;

  const { user, reports } = data;
  const profile = user?.Profile || null;
  // Server-derived: the newest row is routinely a `pending` order nobody paid
  // or a `cancelled` row left by an override, so the panel reads the same
  // active-plan predicate every entitlement gate uses.
  const subscription = user?.activeSubscription || null;
  const subscriptionHistory = user?.Subscriptions || [];
  const verifications = user?.Verifications || [];
  // There is no `User.verificationStatus` column — the badge is derived from an
  // approved Verification row (the same rule searchController uses). Reading
  // the non-existent field meant this chip never rendered, for anyone.
  const isVerified = verifications.some((v) => v.status === 'approved');

  // Everything the member has uploaded, so a reviewer can actually see what
  // they are moderating. Main photo first, then the rest of the gallery, then
  // the verification selfie (a signed URL; view-only here — the selfie is
  // decided through the verification approve/reject flow, not photo removal).
  const galleryPhotos = Array.isArray(profile?.photos) ? profile.photos.filter(Boolean) : [];
  const mainPhoto = profile?.profilePhoto || '';
  const moderatablePhotos = [mainPhoto, ...galleryPhotos.filter((p) => p !== mainPhoto)].filter(Boolean);
  const selfie = verifications.map((v) => v.selfiePhoto).find(Boolean) || '';
  const hasAnyPhoto = moderatablePhotos.length > 0 || Boolean(selfie);

  // A plain render function, not a component declared inside this one: a
  // component defined in render is a new type every render, so React unmounted
  // and re-fetched every photo whenever any state on this page changed.
  const renderPhotoTile = ({ url, label, moderatable }) => {
    const failed = failedPhotos.has(url);
    return (
      <div key={url} className="rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
        <div className="relative">
          {failed ? (
            <div className="w-full h-40 flex flex-col items-center justify-center gap-1.5 text-gray-500 text-xs px-3 text-center">
              <FiImage className="w-5 h-5" aria-hidden="true" />
              <span>This photo did not load.</span>
              <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary-600 hover:underline">Open original</a>
            </div>
          ) : (
            <button type="button" onClick={() => setLightbox(url)} className="block w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500" title="View full size">
              <RetryImage
                src={url}
                alt={label ? `${label} photo` : 'Member photo'}
                className="w-full h-40 object-cover"
                loading="lazy"
                onError={() => setFailedPhotos((prev) => new Set(prev).add(url))}
              />
            </button>
          )}
          {label && (
            <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full bg-black/65 text-white text-[11px] font-medium pointer-events-none">{label}</span>
          )}
        </div>
        {/* Always visible: hover-only controls were invisible on a tablet. */}
        {moderatable && can('reports') && (
          <div className="flex border-t border-gray-200">
            <button
              type="button"
              onClick={() => { setPhotoReason(''); setPhotoAction({ type: 'flag', url }); }}
              className="flex-1 min-h-[36px] text-xs font-semibold text-amber-700 hover:bg-amber-50 flex items-center justify-center gap-1"
            >
              <FiFlag className="w-3.5 h-3.5" aria-hidden="true" /> Flag
            </button>
            <button
              type="button"
              onClick={() => { setPhotoReason(''); setPhotoAction({ type: 'remove', url }); }}
              className="flex-1 min-h-[36px] text-xs font-semibold text-red-600 hover:bg-red-50 border-l border-gray-200 flex items-center justify-center gap-1"
            >
              <FiTrash2 className="w-3.5 h-3.5" aria-hidden="true" /> Remove
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Back */}
      <Link
        to="/admin/users"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 transition-colors"
      >
        <FiArrowLeft className="w-4 h-4" /> Back to Users
      </Link>

      {/* Profile header */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100 flex flex-wrap md:flex-nowrap items-start gap-4 sm:gap-5">
        <div className="w-16 h-16 rounded-2xl bg-primary-100 flex items-center justify-center text-primary-700 text-xl font-bold flex-shrink-0">
          {((profile?.firstName?.[0] || '') + (profile?.lastName?.[0] || '')).toUpperCase() || 'U'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-gray-900 break-words">{[profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || '—'}</h2>
            {isVerified && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                <FiCheckCircle className="w-3 h-3" /> Verified
              </span>
            )}
            {subscription && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">
                <FaCrown className="w-3 h-3" /> {planLabel(subscription.planType)}
              </span>
            )}
            {user.invisible && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full text-xs font-semibold">
                <FiEyeOff className="w-3 h-3" aria-hidden="true" /> Invisible
              </span>
            )}
          </div>
          <p className="text-gray-500 text-sm break-all">{user.email}</p>
          <p className="text-gray-500 text-xs mt-1 break-all">ID: {user.id} · Role: {user.role} · Status: {user.status}</p>
        </div>
        {/* On a phone the actions drop below the name as a full-width row of
            wrapping buttons; beside it they ran off the right edge. */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto md:justify-end">
          {/* Everything staff have done to or looked at on this member. */}
          {can('team') && (
            <Link
              to={`/admin/audit-log?target=${user.id}`}
              className="flex items-center gap-2 px-4 py-2 min-h-[40px] bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
            >
              <FiShield className="w-3.5 h-3.5" aria-hidden="true" /> Audit trail
            </Link>
          )}
          {can('users') && user.role === 'user' && (
            user.invisible ? (
              <button
                onClick={() => { setVisReason(''); setVisTarget(false); }}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
              >
                <FiEye className="w-3.5 h-3.5" aria-hidden="true" /> Make visible
              </button>
            ) : (
              <button
                onClick={() => { setVisReason(''); setVisTarget(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
              >
                <FiEyeOff className="w-3.5 h-3.5" aria-hidden="true" /> Make invisible
              </button>
            )
          )}
          {can('users') && user.role === 'user' && (
            user.status === 'banned' ? (
              <button
                onClick={() => { setStatusReason(''); setStatusTarget('active'); }}
                className="flex items-center gap-2 px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-xl text-sm font-medium transition-colors"
              >
                <FiRotateCcw className="w-3.5 h-3.5" /> Reinstate
              </button>
            ) : (
              <button
                onClick={() => { setStatusReason(''); setStatusTarget('banned'); }}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors"
              >
                <FiSlash className="w-3.5 h-3.5" /> Ban user
              </button>
            )
          )}
          {canDelete && user.role === 'user' && (
            <button
              onClick={handleDeleteAccount}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-sm font-medium transition-colors"
            >
              <FiTrash2 className="w-3.5 h-3.5" /> Delete
            </button>
          )}
          {can('subscriptions') && (
          <button
            onClick={() => { setNewPlan(subscription?.planType || 'free'); setReason(''); setPlanModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-xl text-sm font-medium transition-colors"
          >
            <FaCrown className="w-3.5 h-3.5" /> Override Plan
          </button>
          )}
          {/* Only where there is something to end — a mis-grant or a refunded
              payment previously had no in-product remedy at all. */}
          {subscription && can('subscriptions') && (
            <button
              onClick={() => { setCancelReason(''); setCancelModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-sm font-medium transition-colors"
            >
              End plan
            </button>
          )}
        </div>
      </div>

      {user.invisible && (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 flex items-start gap-3" role="status">
          <FiEyeOff className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-sm text-gray-700">
            <p className="font-semibold text-gray-900">
              Invisible to other members since {new Date(user.invisible.since).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              {user.invisible.byEmail ? <span className="font-normal text-gray-600"> · by {user.invisible.byEmail}</span> : null}
            </p>
            {user.invisible.reason && <p className="mt-0.5">Reason: {user.invisible.reason}</p>}
            <p className="mt-1 text-gray-600">Not shown in search, daily matches or profile-code lookups. They can still sign in, and anyone they like or message can still see them. They have not been told.</p>
          </div>
        </div>
      )}

      {/* Which marketing partner this member is credited to. Credit never moves
          once earned, so this is the partner who gets commission on them. */}
      {user.partnerCredit && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <FiUsers className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-sm text-gray-700 min-w-0">
              <p className="font-semibold text-gray-900">
                Joined through partner{' '}
                {can('marketing') ? (
                  <Link to={`/admin/marketing-users/${user.partnerCredit.partnerId}`} className="text-primary-700 hover:underline break-words">
                    {user.partnerCredit.partnerName || user.partnerCredit.partnerEmail}
                  </Link>
                ) : (user.partnerCredit.partnerName || user.partnerCredit.partnerEmail)}
              </p>
              <p className="mt-0.5 text-gray-600">
                {user.partnerCredit.referralCode ? <>Code <span className="font-mono">{user.partnerCredit.referralCode}</span></> : 'Added by the partner by hand'}
                {user.partnerCredit.campaign ? ` · ${user.partnerCredit.campaign}` : ''}
                {user.partnerCredit.partnerStatus && user.partnerCredit.partnerStatus !== 'active' ? ` · partner ${user.partnerCredit.partnerStatus}` : ''}
              </p>
            </div>
          </div>
          {can('marketing') && (
            <Link
              to={`/admin/leads?marketingUserId=${user.partnerCredit.partnerId}`}
              className="inline-flex items-center min-h-[44px] text-sm font-medium text-primary-700 hover:underline"
            >
              Partner's members
            </Link>
          )}
        </div>
      )}

      {/* Photos — the whole gallery the member shows, plus their verification
          selfie, so an admin can review what is actually on the profile and act
          on anything inappropriate. */}
      <Section title="Photos">
        {hasAnyPhoto ? (
          <>
            {moderatablePhotos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {moderatablePhotos.map((url, i) => (
                  renderPhotoTile({ url, label: i === 0 && url === mainPhoto ? 'Main' : null, moderatable: true })
                ))}
              </div>
            )}
            {selfie && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 mb-2">Verification selfie</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {renderPhotoTile({ url: selfie, label: 'Selfie', moderatable: false })}
                </div>
              </div>
            )}
            {!can('reports') && moderatablePhotos.length > 0 && (
              <p className="text-xs text-gray-400 mt-3">Flag and remove need the <span className="font-medium">reports</span> permission.</p>
            )}
          </>
        ) : (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
            <FiImage className="w-4 h-4" /> No photos uploaded yet.
          </div>
        )}
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Account info */}
        <Section title="Account Information">
          <InfoRow label="Email"         value={user.email} />
          <InfoRow label="Phone"         value={user.phone} />
          <InfoRow label="Role"          value={user.role} />
          <InfoRow label="Status"        value={user.status} />
          <InfoRow label="Joined"        value={user.createdAt ? formatDateTime(user.createdAt) : null} />
          <InfoRow label="Last Login"    value={user.lastLogin ? formatDateTime(user.lastLogin) : null} />
          {/* DPDP consent record. NULL = account predates the record (mig 000062) — not a refusal. */}
          <InfoRow
            label="Terms Accepted"
            value={user.termsAcceptedAt
              ? `${formatDateTime(user.termsAcceptedAt)}${user.termsVersion ? ` (v${user.termsVersion})` : ''}`
              : 'Before consent records began'}
          />
        </Section>

        {/* Profile info */}
        <Section title="Profile Information">
          {profile ? (
            <>
              <InfoRow label="Gender"        value={profile.gender} />
              <InfoRow label="Date of Birth" value={profile.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null} />
              {profile.height && <InfoRow label="Height" value={`${profile.height} cm`} />}
              {profile.maritalStatus && <InfoRow label="Marital Status" value={String(profile.maritalStatus).replace(/_/g, ' ')} />}
              <InfoRow label="City"          value={profile.city} />
              {(profile.state || profile.familyLocation) && <InfoRow label="State / Area" value={profile.state || profile.familyLocation} />}
              {profile.isNri && <InfoRow label="NRI" value={profile.residenceCountry ? `Yes · ${profile.residenceCountry}` : 'Yes'} />}
              <InfoRow label="Religion"      value={profile.religion} />
              <InfoRow label="Caste"         value={profile.caste} />
              {profile.subCaste && <InfoRow label="Sub-caste" value={profile.subCaste} />}
              {profile.gotra && <InfoRow label="Gotra" value={profile.gotra} />}
              {profile.motherTongue && <InfoRow label="Mother Tongue" value={profile.motherTongue} />}
              {profile.manglikStatus && <InfoRow label="Manglik" value={profile.manglikStatus} />}
              <InfoRow label="Education"     value={profile.education || profile.educationLevel} />
              {profile.institution && <InfoRow label="Institution" value={profile.institution} />}
              <InfoRow label="Profession"    value={profile.profession || profile.professionGroup} />
              {profile.income && <InfoRow label="Income" value={profile.income} />}
              {profile.familyType && <InfoRow label="Family Type" value={String(profile.familyType).replace(/_/g, ' ')} />}
              {(profile.diet || profile.smoking || profile.drinking) && (
                <InfoRow label="Lifestyle" value={[profile.diet, profile.smoking && `smoking: ${profile.smoking}`, profile.drinking && `drinking: ${profile.drinking}`].filter(Boolean).join(' · ')} />
              )}
              {profile.bio && (
                <div className="pt-2 mt-1 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-1">About</p>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{profile.bio}</p>
                </div>
              )}
              <div className="pt-2 mt-1 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Privacy</p>
                <InfoRow label="Profile visibility" value={profile.profileVisibility === 'matches_only' ? 'Matches only' : 'Everyone'} />
                <InfoRow
                  label="Phone and email"
                  value={{ everyone: 'Anyone who unlocks', matches: 'Matches only', hidden: 'Hidden from everyone' }[profile.fieldVisibility?.contact || 'everyone']}
                />
                {profile.incognitoMode && <InfoRow label="Incognito" value="On" />}
              </div>
            </>
          ) : (
            <div className="text-sm text-neutral-600 bg-neutral-50 border border-neutral-200 rounded-lg p-4">
              <p className="font-medium text-neutral-800 mb-1">Onboarding not completed</p>
              <p>
                This member created an account but hasn&apos;t filled their profile yet — matching
                and search won&apos;t surface them until they do. Account, subscription and
                verification details are still shown below.
              </p>
            </div>
          )}
        </Section>

        {/* Subscription */}
        <Section title="Subscription">
          {subscription ? (
            <>
              <InfoRow label="Plan"       value={planLabel(subscription.planType)} />
              <InfoRow label="Status"     value={subscription.status} />
              <InfoRow label="Start Date" value={subscription.startDate ? formatDate(subscription.startDate) : null} />
              <InfoRow label="End Date"   value={subscription.endDate ? formatDate(subscription.endDate) : null} />
              {/* A staff grant stores the plan's list price but no payment reference. */}
              <InfoRow label="Amount"     value={subscription.amount == null ? null
                : subscription.razorpayPaymentId ? `₹${Number(subscription.amount).toLocaleString('en-IN')}`
                : 'Granted by staff (not paid)'} />
            </>
          ) : (
            <p className="text-sm text-gray-400">No active subscription (Free plan)</p>
          )}
          {subscriptionHistory.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mb-2">History</p>
              <div className="space-y-1">
                {subscriptionHistory.map((h) => {
                  const paid = Boolean(h.razorpayPaymentId) && Number(h.amount) > 0;
                  const refunded = Number(h.refundedAmount) || 0;
                  // An order id with no payment is a checkout the member closed; a staff grant has neither.
                  // A Google Play purchase stores its token in razorpayPaymentId;
                  // those are refunded from the Play Console, not here.
                  const refundable = paid && h.razorpaySignature !== 'GOOGLE_PLAY' && !h.refundedAt && refunded < Number(h.amount);
                  return (
                    <div key={h.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-gray-500">
                      <span>{planLabel(h.planType)}</span>
                      <span>{h.status}</span>
                      <span>{paid ? `₹${Number(h.amount).toLocaleString('en-IN')}` : h.razorpayOrderId ? 'not paid' : (Number(h.amount) > 0 ? 'granted' : '—')}</span>
                      <span>{h.endDate ? formatDate(h.endDate) : '—'}</span>
                      {(h.refundedAt || refunded > 0) && <span className="text-red-700 font-medium">{h.refundedAt ? 'Refunded in full' : `Refunded ₹${refunded.toLocaleString('en-IN')}`}</span>}
                      {refundable && can('subscriptions') && (
                        <button
                          type="button"
                          onClick={() => openRefund(h)}
                          className="inline-flex items-center min-h-[32px] px-2 rounded-lg text-red-700 font-medium hover:bg-red-50"
                        >
                          Refund
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Section>

        {/* Verifications */}
        <Section title="Verification Requests">
          {verifications && verifications.length > 0 ? (
            <div className="space-y-3">
              {verifications.map((v) => (
                <div key={v.id} className="flex items-start justify-between gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="flex items-start gap-3">
                    {v.selfiePhoto && (
                      <img src={v.selfiePhoto} alt="Selfie" className="w-10 h-10 rounded-lg object-cover border border-gray-200 flex-shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-800">Photo verification</p>
                      <p className="text-xs text-gray-400">{formatDate(v.createdAt)}</p>
                      {v.adminNotes && <p className="text-xs text-gray-500 mt-1">{v.adminNotes}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {v.status === 'pending' && can('verifications') ? (
                      <>
                        <button
                          onClick={() => handleVerification(v.id, 'approved')}
                          className="p-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                          title="Approve"
                        >
                          <FiCheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleVerification(v.id, 'rejected')}
                          className="p-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                          title="Reject"
                        >
                          <FiXCircle className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${v.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {v.status}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No verification requests</p>
          )}
        </Section>
      </div>

      {/* Reports received */}
      {reports && reports.length > 0 && (
        <Section title="Reports Received">
          <div className="space-y-2">
            {reports.map((r) => (
              <div key={r.id} className="flex items-start justify-between gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-800 capitalize">{r.reason?.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-gray-500">{r.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(r.createdAt)}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${
                  r.status === 'resolved' ? 'bg-green-100 text-green-700' :
                  r.status === 'dismissed' ? 'bg-gray-100 text-gray-600' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <ModerationHistory userId={userId} />

      {/* Override Plan Modal */}
      {planModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-label="Override subscription plan" className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Override Subscription Plan</h3>
            <p className="text-sm text-gray-500 mb-4">Manually set the subscription plan for this user.</p>
            <select
              value={newPlan}
              onChange={(e) => setNewPlan(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-2"
            >
              {planOptions.map((p) => (
                <option key={p.planType} value={p.planType}>
                  {p.label}
                  {p.durationDays ? ` — ${p.durationDays} days` : ''}
                  {p.price ? ` · ₹${p.price.toLocaleString('en-IN')}` : ''}
                  {p.onSale ? '' : ' (off sale)'}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mb-3">
              Term and unlocks follow the plan as currently priced in Pricing &amp; Offers.
            </p>
            <PlanOverrideNotice
              options={planOptions}
              currentPlan={subscription?.planType}
              nextPlan={newPlan}
              reason={reason}
              onReason={setReason}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setPlanModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateSubscription}
                disabled={saving || Boolean(overrideProblem({ currentPlan: subscription?.planType, nextPlan: newPlan, reason }))}
                className="flex-1 py-2.5 rounded-xl bg-primary-700 hover:bg-primary-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Update Plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End subscription (reason captured + audited) */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div ref={cancelPanelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="End subscription" className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl outline-none">
            <h3 className="text-lg font-bold text-gray-900 mb-1">End this subscription</h3>
            <p className="text-sm text-gray-500 mb-3">The member&apos;s paid access ends now and the reason is written to the audit log. This does not issue a refund.</p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              aria-label="Reason"
              placeholder="Reason (e.g. mis-grant, refunded elsewhere, member request)"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-3"
            />
            <div className="flex gap-3">
              <button onClick={() => setCancelModal(false)} className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors">Cancel</button>
              <button
                onClick={handleCancelPlan}
                disabled={cancelling}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {cancelling ? 'Ending…' : 'End plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund (real money, via Razorpay) */}
      {refundTarget && (() => {
        const left = Math.max(0, (Number(refundTarget.amount) || 0) - (Number(refundTarget.refundedAmount) || 0));
        const amt = Number(refundAmount);
        const problem = !Number.isFinite(amt) || amt <= 0 ? 'Enter an amount above zero'
          : amt > left ? `The most that can be refunded is ₹${left.toLocaleString('en-IN')}`
          : refundReason.trim().length < 5 ? 'Give a reason of at least 5 characters (it is kept in the audit log)'
          : null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div role="dialog" aria-modal="true" aria-labelledby="refund-title" className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
              <h3 id="refund-title" className="text-lg font-bold text-gray-900 mb-1">Refund this payment</h3>
              <p className="text-sm text-gray-600 mb-3">
                Paid ₹{Number(refundTarget.amount).toLocaleString('en-IN')} for {planLabel(refundTarget.planType)}.
                This sends money back to the member&apos;s original payment method through Razorpay and cannot be undone. It does not end their plan; use End plan for that.
              </p>
              <label htmlFor="refund-amount" className="block text-sm font-medium text-gray-700 mb-1">Amount to refund (₹)</label>
              <input
                id="refund-amount"
                type="number"
                min="1"
                max={left}
                step="0.01"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-3"
              />
              <label htmlFor="refund-reason" className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <textarea
                id="refund-reason"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                rows={3}
                placeholder="e.g. within the 7-day window, duplicate payment"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-2"
              />
              {problem && <p role="status" className="text-xs text-amber-800 mb-3">{problem}</p>}
              <div className="flex gap-3 mt-2">
                <button onClick={() => setRefundTarget(null)} className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors">Cancel</button>
                <button
                  onClick={handleRefund}
                  disabled={refunding || Boolean(problem)}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {refunding ? 'Refunding…' : `Refund ₹${Number.isFinite(amt) && amt > 0 ? amt.toLocaleString('en-IN') : ''}`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Full-size photo viewer */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Photo preview"
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/15 hover:bg-white/25 text-white"
            aria-label="Close"
          >
            <FiX className="w-5 h-5" />
          </button>
          <img src={lightbox} alt="Member photo full size" className="max-h-[90vh] max-w-full rounded-xl object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {/* Flag / Remove a photo */}
      {photoAction && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="photo-action-title" className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 id="photo-action-title" className="text-lg font-bold text-gray-900 mb-1">
              {photoAction.type === 'remove' ? 'Remove this photo' : 'Flag this photo for review'}
            </h3>
            <p className="text-sm text-gray-500 mb-3">
              {photoAction.type === 'remove'
                ? 'The photo is deleted from the profile and from storage, and the member is notified. This cannot be undone.'
                : 'The photo stays live but is queued in Photo Review for a decision.'}
            </p>
            <img src={photoAction.url} alt="Selected" className="w-full h-40 object-cover rounded-xl border border-gray-200 mb-3" />
            <textarea
              value={photoReason}
              onChange={(e) => setPhotoReason(e.target.value)}
              rows={3}
              autoFocus
              aria-label="Reason"
              placeholder="Reason (recorded in the audit log, e.g. nudity, not the member, offensive)"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-3"
            />
            <div className="flex gap-3">
              <button onClick={() => setPhotoAction(null)} className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors">Cancel</button>
              <button
                onClick={submitPhotoAction}
                disabled={photoBusy || photoReason.trim().length < 5}
                className={`flex-1 py-2.5 rounded-xl text-white text-sm font-medium transition-colors disabled:opacity-50 ${photoAction.type === 'remove' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600'}`}
              >
                {photoBusy ? 'Working…' : (photoAction.type === 'remove' ? 'Remove photo' : 'Flag photo')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invisible / visible (quiet hide) */}
      {visTarget !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-label={visTarget ? 'Make this member invisible' : 'Make this member visible'} className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              {visTarget ? 'Make this member invisible' : 'Make this member visible'}
            </h3>
            <p className="text-sm text-gray-500 mb-3">
              {visTarget
                ? 'Other members will no longer find them in search, daily matches or by profile code. They can still sign in, and anyone they like or message can still see them. They are not told.'
                : 'They will appear in search and daily matches again.'}
            </p>
            {visTarget && (
              <>
                <label htmlFor="vis-reason" className="block text-xs font-medium text-gray-600 mb-1">Reason (only admins see this)</label>
                <textarea
                  id="vis-reason"
                  value={visReason}
                  onChange={(e) => setVisReason(e.target.value)}
                  rows={3}
                  maxLength={300}
                  autoFocus
                  placeholder="e.g. test account, details being checked"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-3"
                />
              </>
            )}
            <div className="flex gap-3">
              <button onClick={() => setVisTarget(null)} className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors">Cancel</button>
              <button
                onClick={submitVisibility}
                disabled={visBusy || (visTarget && visReason.trim().length < 3)}
                autoFocus={!visTarget}
                className="flex-1 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {visBusy ? 'Working…' : (visTarget ? 'Make invisible' : 'Make visible')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ban / reinstate */}
      {statusTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-label={statusTarget === 'banned' ? 'Ban this user' : 'Reinstate this user'} className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              {statusTarget === 'banned' ? 'Ban this user' : 'Reinstate this user'}
            </h3>
            <p className="text-sm text-gray-500 mb-3">
              {statusTarget === 'banned'
                ? 'The member is signed out everywhere and cannot log back in. They are notified and can appeal. Removing an inappropriate photo is a separate action — do that first if it should come down.'
                : 'The member can sign in and use their account again. They are notified.'}
            </p>
            <textarea
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              rows={3}
              autoFocus
              aria-label={statusTarget === 'banned' ? 'Reason' : 'Note'}
              placeholder={statusTarget === 'banned' ? 'Reason (shown to the member and recorded, e.g. inappropriate photos)' : 'Note (optional, recorded in the audit log)'}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-3"
            />
            <div className="flex gap-3">
              <button onClick={() => setStatusTarget(null)} className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors">Cancel</button>
              <button
                onClick={submitStatusChange}
                disabled={statusBusy || (statusTarget === 'banned' && statusReason.trim().length < 5)}
                className={`flex-1 py-2.5 rounded-xl text-white text-sm font-medium transition-colors disabled:opacity-50 ${statusTarget === 'banned' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
              >
                {statusBusy ? 'Working…' : (statusTarget === 'banned' ? 'Ban user' : 'Reinstate')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
