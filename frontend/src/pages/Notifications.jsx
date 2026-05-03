import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiBell, FiHeart, FiMessageCircle, FiEye, FiStar,
  FiCheckCircle, FiShield, FiInfo, FiCheck,
} from 'react-icons/fi';

const TYPE_ICONS = {
  match:          FiHeart,
  message:        FiMessageCircle,
  profile_view:   FiEye,
  interest:       FiStar,
  verification:   FiShield,
  subscription:   FiCheckCircle,
  system:         FiInfo,
  admin:          FiShield,
};

const TYPE_COLORS = {
  match:        'bg-rose-100 text-rose-600',
  message:      'bg-blue-100 text-blue-600',
  profile_view: 'bg-purple-100 text-purple-600',
  interest:     'bg-amber-100 text-amber-600',
  verification: 'bg-green-100 text-green-600',
  subscription: 'bg-indigo-100 text-indigo-600',
  system:       'bg-gray-100 text-gray-600',
  admin:        'bg-red-100 text-red-600',
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

export default function Notifications() {
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
      await api.patch(`/notifications/${id}/read`);
      setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
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
    } catch {}
  };

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchNotifs(next, true);
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="min-h-screen bg-neutral-50 pt-20 pb-24 md:pb-8 px-4">
      <div className="max-w-xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-neutral-900">Notifications</h1>
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
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-neutral-100">
            <FiBell className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
            <p className="font-semibold text-neutral-700">No notifications yet</p>
            <p className="text-sm text-neutral-400 mt-1">We'll notify you when something happens</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <AnimatePresence>
                {notifications.map((n) => {
                  const Icon  = TYPE_ICONS[n.type]  || FiBell;
                  const color = TYPE_COLORS[n.type] || 'bg-gray-100 text-gray-600';
                  return (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className={`flex items-start gap-3 p-4 rounded-2xl bg-white shadow-sm border transition-all cursor-pointer ${
                        !n.isRead ? 'border-primary-100 bg-primary-50/30' : 'border-neutral-100'
                      }`}
                      onClick={() => !n.isRead && markRead(n.id)}
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
