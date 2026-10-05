import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { FiBell, FiCheck, FiX } from 'react-icons/fi';
import { EmptyState, ErrorState, Skeleton } from '../components/ui';
import { listRow } from '../utils/animations';
import {
  notifLink, iconFor, colorFor, timeAgo, announceNotificationsChanged,
} from '../components/notifications/notificationMeta';

// Kept as a named export: the link map moved to notificationMeta so the navbar
// bell shares it, and existing imports of it from this page still work.
export { notifLink };

export default function Notifications() {
  const navigate = useNavigate();
  const [notifications, setNotifs] = useState([]);
  const [loading, setLoading]      = useState(true);
  const [error, setError]          = useState(false);
  const [page, setPage]            = useState(1);
  const [hasMore, setHasMore]      = useState(false);
  // The server's count covers every page; counting only the loaded rows
  // under-reports as soon as there is more than one page.
  const [serverUnread, setServerUnread] = useState(null);
  const limit = 20;

  // A failed page-1 fetch must never fall through to the empty state — an
  // outage and a genuinely empty inbox are different facts and need
  // different UI (doctrine §6/§9). Pagination failures (`append`) keep the
  // already-loaded list on screen and surface as a toast instead, since a
  // full-page error card would erase notifications the member can already see.
  const fetchNotifs = useCallback(async (p = 1, append = false) => {
    if (!append) { setLoading(true); setError(false); }
    try {
      const res = await api.get('/notifications', { params: { page: p, limit } });
      const data = res.data;
      const list = data.notifications || data || [];
      setNotifs((prev) => {
        if (!append) return list;
        // Offset paging can repeat a row when something was deleted meanwhile.
        const seen = new Set(prev.map((n) => n.id));
        return [...prev, ...list.filter((n) => !seen.has(n.id))];
      });
      // The API answers `pagination.pages`; fall back to "a full page came back".
      const pages = data.pagination?.pages ?? data.totalPages;
      setHasMore(pages != null ? p < pages : list.length === limit);
      if (typeof data.unreadCount === 'number') setServerUnread(data.unreadCount);
    } catch {
      if (append) toast.error('Failed to load notifications');
      else setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotifs(1); }, [fetchNotifs]);

  const markRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      const wasUnread = notifications.some((n) => n.id === id && !n.isRead);
      if (wasUnread) setServerUnread((c) => (c == null ? c : Math.max(0, c - 1)));
      setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
      announceNotificationsChanged();
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
      setServerUnread(0);
      announceNotificationsChanged();
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  const deleteNotif = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      if (notifications.some((n) => n.id === id && !n.isRead)) setServerUnread((c) => (c == null ? c : Math.max(0, c - 1)));
      setNotifs((prev) => prev.filter((n) => n.id !== id));
      announceNotificationsChanged();
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

  const unreadCount = serverUnread ?? notifications.filter((n) => !n.isRead).length;

  return (
    <div className="min-h-[100dvh] bg-neutral-50 dark:bg-surface-dark-1 pt-20 pb-24 md:pb-8 px-4">
      <div className="max-w-xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-neutral-900 dark:text-neutral-100">Notifications</h1>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-primary-500 text-white text-xs font-bold tabular-nums">{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              // py-3 -my-3 pads the tap target to the 44px floor (doctrine
              // §3.5) without growing the visible text+icon mark.
              className="flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 active:scale-[0.97] transition-colors duration-[160ms] px-2 py-3 -mx-2 -my-3"
            >
              <FiCheck className="w-4 h-4" /> Mark all read
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-3 p-4 rounded-2xl shadow-card bg-white dark:bg-surface-dark-3">
                <Skeleton variant="circle" className="w-9 h-9 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <ErrorState
            title="Couldn't load notifications"
            description="The connection dropped before this finished loading. Try again."
            onRetry={() => fetchNotifs(1)}
            className="bg-white dark:bg-surface-dark-3 rounded-2xl shadow-card"
          />
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={FiBell}
            title="No notifications yet"
            description="We'll notify you when something happens"
            actionLabel="Browse profiles"
            onAction={() => navigate('/search')}
            className="bg-white dark:bg-surface-dark-3 rounded-2xl shadow-card"
          />
        ) : (
          <>
            <div className="space-y-2">
              <AnimatePresence>
                {notifications.map((n) => {
                  const Icon  = iconFor(n);
                  const color = colorFor(n);
                  return (
                    <motion.div
                      key={n.id}
                      {...listRow}
                      className={`flex items-start gap-3 p-4 rounded-2xl shadow-card transition-colors duration-[160ms] ${
                        !n.isRead ? 'bg-primary-50/40 dark:bg-primary-900/20' : 'bg-white dark:bg-surface-dark-3'
                      }`}
                    >
                      {/* The open action is a real <button>, so the delete
                          <button> is a SIBLING rather than an interactive control
                          nested inside another one (invalid ARIA). */}
                      <button
                        type="button"
                        onClick={() => handleOpen(n)}
                        aria-label={n.title}
                        className="flex items-start gap-3 flex-1 min-w-0 text-left rounded-xl active:scale-[0.97] transition-transform duration-[160ms] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1"
                      >
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm leading-snug ${!n.isRead ? 'font-semibold text-neutral-900 dark:text-neutral-100' : 'text-neutral-700 dark:text-neutral-300'}`}>
                            {n.title}
                          </p>
                          {n.body && <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">{n.body}</p>}
                          <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">{timeAgo(n.createdAt)}</p>
                        </div>
                      </button>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {!n.isRead && (
                          <div className="w-2 h-2 rounded-full bg-primary-500" />
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteNotif(n.id); }}
                          // w-11 h-11 pads the tap target to the 44px floor
                          // (doctrine §3.5); the icon glyph itself is unchanged.
                          // Resting color meets the 3:1 icon floor so the delete
                          // affordance is visible on touch (no hover to rely on).
                          className="w-11 h-11 rounded-lg flex items-center justify-center text-neutral-500 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 active:scale-[0.97] transition-colors duration-[160ms]"
                          aria-label="Delete notification"
                          title="Delete"
                        >
                          <FiX className="w-3.5 h-3.5" />
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
                className="w-full py-3 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 active:scale-[0.97] transition-colors duration-[160ms]"
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
