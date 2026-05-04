import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getUser, updateSubscription, updateVerification } from '../../api/adminApi';
import toast from 'react-hot-toast';
import { FiArrowLeft, FiDownload, FiShield, FiCheckCircle, FiXCircle } from 'react-icons/fi';
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

const PLAN_OPTIONS = ['free', 'basic', 'premium', 'gold'];

export default function AdminUserDetail() {
  const { userId } = useParams();
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [planModal, setPlanModal] = useState(false);
  const [newPlan, setNewPlan]     = useState('');

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
    } catch {
      toast.error('Update failed');
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600" />
      </div>
    );
  }

  if (!data) return <div className="text-center text-gray-500 py-20">User not found</div>;

  const { user, reports } = data;
  const profile = user?.Profile || null;
  const subscription = user?.Subscriptions?.[0] || null;
  const verifications = user?.Verifications || [];

  return (
    <div className="space-y-5">
      {/* Back */}
      <Link
        to="/admin/users"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-rose-600 transition-colors"
      >
        <FiArrowLeft className="w-4 h-4" /> Back to Users
      </Link>

      {/* Profile header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-start gap-5">
        <div className="w-16 h-16 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-700 text-xl font-bold flex-shrink-0">
          {((user.firstName?.[0] || '') + (user.lastName?.[0] || '')).toUpperCase() || 'U'}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-gray-900">{user.firstName} {user.lastName}</h2>
            {user.verificationStatus === 'approved' && (
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
        <button
          onClick={() => { setNewPlan(subscription?.planType || 'free'); setPlanModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-xl text-sm font-medium transition-colors"
        >
          <FaCrown className="w-3.5 h-3.5" /> Override Plan
        </button>
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
        </Section>

        {/* Profile info */}
        <Section title="Profile Information">
          {profile ? (
            <>
              <InfoRow label="Gender"       value={profile.gender} />
              <InfoRow label="Date of Birth" value={profile.dateOfBirth} />
              <InfoRow label="City"         value={profile.city} />
              <InfoRow label="Religion"     value={profile.religion} />
              <InfoRow label="Caste"        value={profile.caste} />
              <InfoRow label="Education"    value={profile.education} />
              <InfoRow label="Profession"   value={profile.profession} />
            </>
          ) : (
            <p className="text-sm text-gray-400">No profile created yet</p>
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
              <InfoRow label="Amount"     value={subscription.paymentAmount ? `₹${subscription.paymentAmount}` : null} />
            </>
          ) : (
            <p className="text-sm text-gray-400">No active subscription (Free plan)</p>
          )}
        </Section>

        {/* Verifications */}
        <Section title="Verification Requests">
          {verifications && verifications.length > 0 ? (
            <div className="space-y-3">
              {verifications.map((v) => (
                <div key={v.id} className="flex items-start justify-between gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-800 capitalize">{v.documentType}</p>
                    <p className="text-xs text-gray-400">{new Date(v.createdAt).toLocaleDateString('en-IN')}</p>
                    {v.adminNotes && <p className="text-xs text-gray-500 mt-1">{v.adminNotes}</p>}
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
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 mb-4"
            >
              {PLAN_OPTIONS.map((p) => (
                <option key={p} value={p} className="capitalize">{p}</option>
              ))}
            </select>
            <div className="flex gap-3">
              <button
                onClick={() => setPlanModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateSubscription}
                className="flex-1 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-600 text-white text-sm font-medium transition-colors"
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
