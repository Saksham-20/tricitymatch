/**
 * Crash reporting.
 *
 * Until now the app had none. A crash in the field was invisible — the only way
 * to learn about one was a user complaining, and the only way to reproduce it was
 * guessing. That is not survivable once the app is in a store, and it is barely
 * survivable during the QA that precedes it.
 *
 * Config-gated on EXPO_PUBLIC_SENTRY_DSN. With no DSN this is a complete no-op:
 * nothing initialises, nothing is sent, and no network call is attempted. That
 * matters because the DSN is an owner-supplied credential, and a crash reporter
 * that throws on startup because it was not configured would be worse than none.
 *
 * Deliberately NOT capturing:
 *   - request/response bodies — profiles here contain caste, religion, income and
 *     photographs. Sending that to a third party to debug a null pointer is not a
 *     trade worth making, and would need to be declared in both stores'
 *     data-safety forms.
 *   - the user's email or phone. The user id is enough to correlate a report with
 *     an account, and it is not directly identifying on its own.
 */

import { CONFIG } from '../constants/config';

type SentryLike = {
  init: (options: Record<string, unknown>) => void;
  setUser: (user: { id: string } | null) => void;
  captureException: (error: unknown, hint?: Record<string, unknown>) => void;
  ReactNativeTracing?: unknown;
};

let sentry: SentryLike | null = null;

/** Loaded lazily so Expo Go — where the native module is absent — still runs. */
const load = (): SentryLike | null => {
  if (sentry) return sentry;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    sentry = require('@sentry/react-native') as SentryLike;
    return sentry;
  } catch {
    return null;
  }
};

export const initCrashReporting = (): void => {
  if (!CONFIG.IS_SENTRY_CONFIGURED) return;

  const s = load();
  if (!s) return;

  s.init({
    dsn: CONFIG.SENTRY_DSN,
    // Dev builds would otherwise flood the project with errors from work in
    // progress, and drown the reports that came from a real user.
    enabled: !CONFIG.IS_DEV,
    environment: CONFIG.IS_DEV ? 'development' : 'production',
    // Traces cost quota and we have no performance budget defined yet; crashes
    // are the thing we are actually blind to.
    tracesSampleRate: 0,
    // Breadcrumbs are useful, but the default http breadcrumb records URLs, and
    // ours embed user ids. Keep navigation and console, drop the network ones.
    beforeBreadcrumb: (breadcrumb: { category?: string } | null) =>
      breadcrumb && (breadcrumb.category === 'http' || breadcrumb.category === 'xhr')
        ? null
        : breadcrumb,
    sendDefaultPii: false,
  });
};

/**
 * Associate subsequent reports with an account. Id only — see the note above on
 * what is deliberately not sent.
 */
export const setCrashReportingUser = (userId: string | null): void => {
  if (!CONFIG.IS_SENTRY_CONFIGURED) return;
  const s = load();
  if (!s) return;
  s.setUser(userId ? { id: userId } : null);
};

/**
 * Report a handled error — one that was caught and recovered from, but that
 * should not have happened. Unhandled crashes are captured automatically.
 */
export const reportError = (error: unknown, context?: Record<string, unknown>): void => {
  if (!CONFIG.IS_SENTRY_CONFIGURED) {
    if (CONFIG.IS_DEV) console.error('[crash-reporting disabled]', error, context);
    return;
  }
  const s = load();
  if (!s) return;
  s.captureException(error, context ? { extra: context } : undefined);
};
