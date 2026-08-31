import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getUser, updateSubscription, updateVerification, cancelSubscription } from '../../api/adminApi';
import usePlanOptions from '../../hooks/usePlanOptions';
import toast from 'react-hot-toast';
import { FiArrowLeft, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';

const Section = ({ title, children }) => (
  <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
    <h3 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">{title}</h3>
    {children}
  </div>
);

const InfoRow = ({ label, value }) => (
  <div className="flex items-start gap-2 py-1.5">
    <span className="text-xs text-gray-400 w-36 flex-shrink-0">{label}</span>
    <span className="text-sm text-gray-800 font-medium">{value || '—'}</span>
  </div>
);

export default function AdminUserDetail() {
  const { userId } = useParams();
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [planModal, setPlanModal] = useState(false);
  const [newPlan, setNewPlan]     = useState('');
  const { options: planOptions } = usePlanOptions();

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

  const handleUpdateSubscription = async () => {
    try {
      await updateSubscription(userId, { planType: newPlan });
      toast.success('Subscription updated');
      setPlanModal(false);
      fetchUser();
    } catch (err) {
      // Surface what the server said. A generic "Update failed" is how the
      // stale plan-key bug stayed invisible: the API was answering
      // "planType: Invalid value" and the panel showed nothing useful.
      const e = err?.response?.data?.error;
      toast.error(e?.details?.[0]?.message ? `${e.message}: ${e.details[0].message}` : (e?.message || 'Update failed'));
    }
  };

  const handleCancelPlan = async () => {
    // Confirm first: this ends a member's paid access immediately and there is
    // no undo beyond granting it again.
    if (!window.confirm('End this member\u2019s current plan now? Their profile and matches are unchanged.')) return;
    const reason = window.prompt('Why is it being cancelled? (recorded in the audit log)') || '';
    try {
      await cancelSubscription(userId, { reason });
      toast.success('Plan cancelled');
      fetchUser();
    } catch (err) {
      const e = err?.response?.data?.error;
      toast.error(e?.message || 'Could not cancel the plan');
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
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-start gap-5">
        <div className="w-16 h-16 rounded-2xl bg-primary-100 flex items-center justify-center text-primary-700 text-xl font-bold flex-shrink-0">
          {((profile?.firstName?.[0] || '') + (profile?.lastName?.[0] || '')).toUpperCase() || 'U'}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-gray-900">{[profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || '—'}</h2>
            {isVerified && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                <FiCheckCircle className="w-3 h-3" /> Verified
              </span>
            )}
            {subscription && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">
                <FaCrown className="w-3 h-3" /> {subscription.planType}
              </span>
            )}
          </div>
          <p className="text-gray-500 text-sm">{user.email}</p>
          <p className="text-gray-400 text-xs mt-1">ID: {user.id} · Role: {user.role} · Status: {user.status}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setNewPlan(subscription?.planType || 'free'); setPlanModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-xl text-sm font-medium transition-colors"
          >
            <FaCrown className="w-3.5 h-3.5" /> Override Plan
          </button>
          {/* Only where there is something to end — a mis-grant or a refunded
              payment previously had no in-product remedy at all. */}
          {subscription && (
            <button
              onClick={handleCancelPlan}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-sm font-medium transition-colors"
            >
              End plan
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Account info */}
        <Section title="Account Information">
          <InfoRow label="Email"         value={user.email} />
          <InfoRow label="Phone"         value={user.phone} />
          <InfoRow label="Role"          value={user.role} />
          <InfoRow label="Status"        value={user.status} />
          <InfoRow label="Joined"        value={user.createdAt ? new Date(user.createdAt).toLocaleString('en-IN') : null} />
          <InfoRow label="Last Login"    value={user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('en-IN') : null} />
          {/* DPDP consent record. NULL = account predates the record (mig 000062) — not a refusal. */}
          <InfoRow
            label="Terms Accepted"
            value={user.termsAcceptedAt
              ? `${new Date(user.termsAcceptedAt).toLocaleString('en-IN')}${user.termsVersion ? ` (v${user.termsVersion})` : ''}`
              : 'Before consent records began'}
          />
        </Section>

        {/* Profile info */}
        <Section title="Profile Information">
          {profile ? (
            <>
              <InfoRow label="Gender"       value={profile.gender} />
              <InfoRow label="Date of Birth" value={profile.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null} />
              <InfoRow label="City"         value={profile.city} />
              <InfoRow label="Religion"     value={profile.religion} />
              <InfoRow label="Caste"        value={profile.caste} />
              <InfoRow label="Education"    value={profile.education} />
              <InfoRow label="Profession"   value={profile.profession} />
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
              <InfoRow label="Plan"       value={subscription.planType} />
              <InfoRow label="Status"     value={subscription.status} />
              <InfoRow label="Start Date" value={subscription.startDate ? new Date(subscription.startDate).toLocaleDateString('en-IN') : null} />
              <InfoRow label="End Date"   value={subscription.endDate ? new Date(subscription.endDate).toLocaleDateString('en-IN') : null} />
              <InfoRow label="Amount"     value={subscription.amount != null ? `₹${Number(subscription.amount).toLocaleString('en-IN')}` : null} />
            </>
          ) : (
            <p className="text-sm text-gray-400">No active subscription (Free plan)</p>
          )}
          {subscriptionHistory.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mb-2">History</p>
              <div className="space-y-1">
                {subscriptionHistory.map((h) => (
                  <div key={h.id} className="flex items-center justify-between text-xs text-gray-500">
                    <span className="capitalize">{String(h.planType).replace(/_/g, ' ')}</span>
                    <span>{h.status}</span>
                    <span>{h.endDate ? new Date(h.endDate).toLocaleDateString('en-IN') : '—'}</span>
                  </div>
                ))}
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
                      <p className="text-xs text-gray-400">{new Date(v.createdAt).toLocaleDateString('en-IN')}</p>
                      {v.adminNotes && <p className="text-xs text-gray-500 mt-1">{v.adminNotes}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {v.status === 'pending' ? (
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
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(r.createdAt).toLocaleDateString('en-IN')}</p>
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

      {/* Override Plan Modal */}
      {planModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
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
            <p className="text-xs text-gray-400 mb-4">
              Term and unlocks follow the plan as currently priced in Pricing &amp; Offers.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setPlanModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateSubscription}
                className="flex-1 py-2.5 rounded-xl bg-primary-700 hover:bg-primary-600 text-white text-sm font-medium transition-colors"
              >
                Update Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
