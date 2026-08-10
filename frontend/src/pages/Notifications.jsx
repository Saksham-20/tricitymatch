import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiBell, FiHeart, FiMessageCircle, FiEye, FiStar,
  FiCheckCircle, FiShield, FiInfo, FiCheck, FiClock,
} from 'react-icons/fi';

const TYPE_ICONS = {
  new_match:             FiHeart,
  match:                 FiHeart,
  message:               FiMessageCircle,
  new_message:           FiMessageCircle,
  profile_view:          FiEye,
  interest:              FiStar,
  verification_approved: FiCheckCircle,
  verification_rejected: FiShield,
  verification:          FiShield,
  subscription:          FiCheckCircle,
  subscription_expiring: FiClock,
  report_reviewed:       FiShield,
  system:                FiInfo,
  admin:                 FiShield,
};

const TYPE_COLORS = {
  new_match:             'bg-primary-100 text-primary-600',
  match:                 'bg-primary-100 text-primary-600',
  message:               'bg-info-light text-info',
  new_message:           'bg-info-light text-info',
  profile_view:          'bg-neutral-100 text-neutral-600',
  interest:              'bg-gold-100 text-gold-700',
  verification_approved: 'bg-success-50 text-success',
  verification_rejected: 'bg-destructive-light text-destructive',
  verification:          'bg-success-50 text-success',
  subscription:          'bg-primary-100 text-primary-600',
  subscription_expiring: 'bg-gold-100 text-gold-700',
  report_reviewed:       'bg-neutral-100 text-neutral-600',
  system:                'bg-neutral-100 text-neutral-600',
  admin:                 'bg-destructive-light text-destructive',
};

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1)    return 'Just now';
  if (minutes < 60)   return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)     return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7)       return `${days}d ago`;
  return new Date(date).toLocaleDateString('en-IN');
}

// Where a notification should take the user when tapped.
//
// This map must cover every value of the Notifications.type ENUM
// (backend/models/Notification.js). A type that falls through to `default`
// silently becomes a dead tap: the row marks itself read and nothing happens,
// which reads as a broken app rather than as a deliberate no-destination.
//
// `subscription_expiring` and `report_reviewed` were both missing — the first
// is emitted at renewal time, the second by the admin report review, and both
// landed on `default`. The old 'subscription' / 'verification' / 'message' keys
// are not ENUM values at all; they are kept as harmless aliases in case an
// older client or a future emitter uses the short form.
//
// `new_match` carries a MATCH id in relatedId, NOT a userId, so it cannot route
// to a profile — it goes to the Mutual tab of the matches hub, which is the
// thing the notification is actually about.
export const notifLink = (n) => {
  switch (n.type) {
    case 'new_match':            return '/matches?tab=mutual';
    case 'message':
    case 'new_message':          return '/chat';
    case 'profile_view':         return n.relatedId ? `/profile/${n.relatedId}` : '/profile';
    case 'verification_approved':
    case 'verification_rejected':
    case 'verification':         return '/verification';
    case 'subscription_expiring':
    case 'subscription':         return '/subscription';
    // The reporter has no "my reports" view to land on, and inventing one is
    // out of scope here; Safety is where reporting is explained, so the tap at
    // least goes somewhere related instead of dying.
    case 'report_reviewed':      return '/safety';
    default:                     return null; // 'system' + unknown: just mark read
  }
};

export default function Notifications() {
  const navigate = useNavigate();
  const [notifications, setNotifs] = useState([]);
  const [loading, setLoading]      = useState(true);
  const [page, setPage]            = useState(1);
  const [hasMore, setHasMore]      = useState(false);
  const limit = 20;

  const fetchNotifs = useCallback(async (p = 1, append = false) => {
    try {
      const res = await api.get('/notifications', { params: { page: p, limit } });
      const data = res.data;
      const list = data.notifications || data || [];
      setNotifs((prev) => append ? [...prev, ...list] : list);
      setHasMore(list.length === limit && (data.totalPages ? p < data.totalPages : false));
    } catch {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotifs(1); }, [fetchNotifs]);

  const markRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    } catch {
      // Marking-as-read fires as a side effect of opening a notification. A
      // toast here would interrupt the thing the member actually clicked on;
      // the unread dot simply stays, which is the honest outcome.
    }
  };

  const markAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  const deleteNotif = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifs((prev) => prev.filter((n) => n.id !== id));
    } catch {
      // Delete is an explicit, destructive tap — silence made it look dead.
      toast.error('Could not delete that notification');
    }
  };

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchNotifs(next, true);
  };

  const handleOpen = (n) => {
    if (!n.isRead) markRead(n.id);
    const to = notifLink(n);
    if (to) navigate(to);
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0f1117] pt-20 pb-24 md:pb-8 px-4">
      <div className="max-w-xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-neutral-900 dark:text-neutral-100">Notifications</h1>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-primary-500 text-white text-xs font-bold">{unreadCount}</span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              <FiCheck className="w-4 h-4" /> Mark all read
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white dark:bg-[#1a1f2e] rounded-2xl p-12 text-center shadow-card border border-neutral-100 dark:border-neutral-800">
            <FiBell className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
            <p className="font-semibold text-neutral-700 dark:text-neutral-200">No notifications yet</p>
            <p className="text-sm text-neutral-400 mt-1">We'll notify you when something happens</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <AnimatePresence>
                {notifications.map((n) => {
                  const Icon  = TYPE_ICONS[n.type]  || FiBell;
                  const color = TYPE_COLORS[n.type] || 'bg-neutral-100 text-neutral-600';
                  return (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className={`flex items-start gap-3 p-4 rounded-2xl shadow-card border transition-all cursor-pointer ${
                        !n.isRead ? 'border-primary-100 dark:border-primary-800 bg-primary-50/40 dark:bg-primary-900/20' : 'border-neutral-100 dark:border-neutral-800 bg-white dark:bg-[#1a1f2e]'
                      }`}
                      onClick={() => handleOpen(n)}
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm leading-snug ${!n.isRead ? 'font-semibold text-neutral-900' : 'text-neutral-700'}`}>
                          {n.title}
                        </p>
                        {n.body && <p className="text-xs text-neutral-500 mt-0.5">{n.body}</p>}
                        <p className="text-xs text-neutral-400 mt-1">{timeAgo(n.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {!n.isRead && (
                          <div className="w-2 h-2 rounded-full bg-primary-500" />
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteNotif(n.id); }}
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-neutral-300 hover:text-neutral-500 hover:bg-neutral-100 transition-colors"
                          title="Delete"
                        >
                          ×
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {hasMore && (
              <button
                onClick={loadMore}
                className="w-full py-3 rounded-2xl bg-white shadow-sm border border-neutral-100 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
              >
                Load more
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
