import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FiBell, FiCheck } from 'react-icons/fi';
import api from '../../api/axios';
import { popIn } from '../../utils/animations';
import {
  notifLink, iconFor, colorFor, timeAgo, announceNotificationsChanged,
} from './notificationMeta';

const PREVIEW_LIMIT = 8;

/**
 * Navbar bell: the unread count, and on tap the latest notifications, each one
 * opening where it belongs. It used to open a panel that only said "N unread"
 * with nothing to read or tap, and on a phone it was buried in the menu.
 *
 * On a phone the panel spans the screen under the navbar; from md up it hangs
 * off the bell.
 *
 * @param {object} props
 * @param {number} props.count              unread count owned by the navbar
 * @param {(n: number) => void} props.onCountChange
 */
const NotificationBell = ({ count = 0, onCountChange }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState('idle'); // idle | loading | ready | error
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const ref = useRef(null);
  const buttonRef = useRef(null);
  const requestRef = useRef(0);

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  }, []);

  const load = useCallback(async () => {
    const request = ++requestRef.current;
    setState((s) => (s === 'ready' ? s : 'loading'));
    try {
      const res = await api.get('/notifications', { params: { page: 1, limit: PREVIEW_LIMIT } });
      if (request !== requestRef.current) return;
      setItems(res.data?.notifications || []);
      setTotal(res.data?.pagination?.total ?? 0);
      if (typeof res.data?.unreadCount === 'number') onCountChange?.(res.data.unreadCount);
      setState('ready');
    } catch {
      if (request === requestRef.current) setState('error');
    }
  }, [onCountChange]);

  // Fresh list every time it opens: a notification that arrived since the last
  // look must be in it.
  useEffect(() => { if (open) load(); }, [open, load]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => {
      if (ref.current && !ref.current.contains(e.target)) close();
    };
    const onKey = (e) => { if (e.key === 'Escape') close(true); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer, { passive: true });
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  const openItem = (n) => {
    if (!n.isRead) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      onCountChange?.(Math.max(0, count - 1));
      api.put(`/notifications/${n.id}/read`)
        .then(() => announceNotificationsChanged())
        // The dot comes back on the next poll; a toast would interrupt the tap.
        .catch(() => {});
    }
    const to = notifLink(n);
    if (to) {
      close();
      navigate(to);
    }
  };

  const markAllRead = async () => {
    const before = items;
    setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
    onCountChange?.(0);
    try {
      await api.put('/notifications/read-all');
      announceNotificationsChanged();
    } catch {
      setItems(before);
      announceNotificationsChanged(); // re-read the true count
    }
  };

  const unreadShown = items.some((n) => !n.isRead);

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`${t('navbar.notifications')}${count > 0 ? `, ${count} unread` : ''}`}
        className="relative w-11 h-11 flex items-center justify-center rounded-xl text-neutral-600 dark:text-neutral-300 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-[color,background-color] duration-[160ms] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <FiBell className="w-5 h-5" aria-hidden="true" />
        {count > 0 && (
          <motion.span
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            aria-hidden="true"
            className="absolute top-1.5 right-1.5 min-w-[1rem] h-4 px-1 bg-primary-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none tabular-nums ring-2 ring-white dark:ring-surface-dark-2"
          >
            {count > 9 ? '9+' : count}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            {...popIn}
            id={panelId}
            role="dialog"
            aria-label={t('navbar.notifications')}
            className="fixed left-3 right-3 top-[4.25rem] md:absolute md:left-auto md:right-0 md:top-12 md:w-96 bg-white dark:bg-surface-dark-3 rounded-2xl shadow-2xl dark:shadow-[0_25px_50px_rgba(0,0,0,0.6)] border border-neutral-100 dark:border-[#252b3b] overflow-hidden z-60 origin-top-right"
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-neutral-100 dark:border-[#252b3b]">
              <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                {t('navbar.notifications')}
                {count > 0 && <span className="ml-1.5 text-neutral-500 dark:text-neutral-400 font-normal tabular-nums">({count})</span>}
              </span>
              {(count > 0 || unreadShown) && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-300 font-medium hover:text-primary-700 transition-colors px-2 py-3 -mx-2 -my-3"
                >
                  <FiCheck className="w-3.5 h-3.5" aria-hidden="true" /> {t('navbar.markAllRead')}
                </button>
              )}
            </div>

            <div className="max-h-[min(26rem,calc(100dvh-10rem))] overflow-y-auto overscroll-contain">
              {state === 'loading' || state === 'idle' ? (
                <ul aria-busy="true" aria-label="Loading notifications">
                  {[0, 1, 2].map((i) => (
                    <li key={i} className="flex items-start gap-3 px-4 py-3">
                      <div className="skeleton w-9 h-9 rounded-full flex-shrink-0" />
                      <div className="flex-1 space-y-2 pt-1">
                        <div className="skeleton h-3 w-2/3 rounded" />
                        <div className="skeleton h-3 w-1/3 rounded" />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : state === 'error' ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">Couldn't load your notifications.</p>
                  <button
                    type="button"
                    onClick={load}
                    className="mt-3 text-sm font-medium text-primary-600 dark:text-primary-300 hover:text-primary-700 px-3 py-2"
                  >
                    Try again
                  </button>
                </div>
              ) : items.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <FiBell className="w-6 h-6 mx-auto text-neutral-400" aria-hidden="true" />
                  <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{t('navbar.allCaughtUp')}</p>
                  <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-500">Likes, matches and messages will show up here.</p>
                </div>
              ) : (
                <ul className="divide-y divide-neutral-100 dark:divide-[#252b3b]">
                  {items.map((n) => {
                    const Icon = iconFor(n);
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => openItem(n)}
                          className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors duration-[160ms] hover:bg-neutral-50 dark:hover:bg-white/5 focus:outline-none focus-visible:bg-neutral-50 dark:focus-visible:bg-white/5 ${
                            n.isRead ? '' : 'bg-primary-50/50 dark:bg-primary-900/15'
                          }`}
                        >
                          <span className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${colorFor(n)}`}>
                            <Icon className="w-4 h-4" aria-hidden="true" />
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className={`block text-sm leading-snug ${n.isRead ? 'text-neutral-700 dark:text-neutral-300' : 'font-semibold text-neutral-900 dark:text-neutral-100'}`}>
                              {n.title}
                            </span>
                            {n.body && (
                              <span className="block text-xs text-neutral-600 dark:text-neutral-400 mt-0.5 line-clamp-2">{n.body}</span>
                            )}
                            <span className="block text-xs text-neutral-500 dark:text-neutral-500 mt-1">{timeAgo(n.createdAt)}</span>
                          </span>
                          {!n.isRead && (
                            <span className="mt-1.5 w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" aria-label="Unread" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="border-t border-neutral-100 dark:border-[#252b3b]">
              <Link
                to="/notifications"
                onClick={() => close()}
                className="flex items-center justify-center min-h-[44px] text-sm text-primary-600 dark:text-primary-300 hover:text-primary-700 hover:bg-neutral-50 dark:hover:bg-white/5 font-medium transition-colors"
              >
                {t('navbar.viewAll')}
                {total > items.length && state === 'ready' && (
                  <span className="ml-1 text-neutral-500 dark:text-neutral-400 font-normal tabular-nums">({total})</span>
                )}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBell;
