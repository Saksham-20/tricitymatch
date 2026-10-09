import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiArrowRight, FiCheckCircle } from 'react-icons/fi';
import { LAUNCH_DATE, launchPhase, launchDateParts } from '../../utils/launchDate';

/**
 * Home launch feature: "Registrations open 11 October", with the date set in a
 * burgundy mandap arch. Sits between Home's announcement strip and the hero.
 *
 * Phases come from utils/launchDate (IST calendar days), so this, the global
 * announcement bar and the partner guide agree on the date:
 *   before → the countdown version
 *   from launch day → "Registrations are open."
 *   after LAUNCH_BANNER_UNTIL → nothing.
 *
 * Doctrine notes (docs/design-handoff/DOCTRINE_2026-09.md):
 *   §2 ruling 2 — no eyebrow above the heading (the mock's "LAUNCH DAY" is gone).
 *   §2 ruling 6 — CTA is 12px radius; pills only for the chip.
 *   §2 ruling 7 — no idle motion; the banner is static.
 *   Colours and type are Home's FontLoader tokens (--burgundy, --gold,
 *   --panel-cream, --ink, --display, --sans); the reactive ones follow html.dark.
 *   The hero owns the page's <h1>, so the headline is an <h2>.
 */

// Last IST calendar day the banner shows; from the 26th it renders nothing.
export const LAUNCH_BANNER_UNTIL = '2026-10-25';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const istDay = (now) => new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

export const launchBannerState = (now = new Date()) => {
  if (istDay(now) > LAUNCH_BANNER_UNTIL) return 'hidden';
  return launchPhase(now).phase === 'before' ? 'before' : 'open';
};

const year = LAUNCH_DATE.slice(0, 4);

// Date words follow the member's language; digits stay Western (en/hi/pa-IN
// all format the day as "11").
const DATE_LOCALES = { en: 'en-IN', hi: 'hi-IN', pa: 'pa-IN' };

export default function LaunchBanner({ now }) {
  const { t, i18n } = useTranslation();
  const state = launchBannerState(now);
  if (state === 'hidden') return null;
  const before = state === 'before';
  const locale = DATE_LOCALES[(i18n.resolvedLanguage || i18n.language || 'en').slice(0, 2)] || 'en-IN';
  const { day: dayNum, month: monthName, weekday } = launchDateParts(locale);
  const dateLabel = `${dayNum} ${monthName}`; // "11 October", day first in every language

  return (
    <section className="launch-feature" aria-labelledby="launch-feature-title">
      <style>{`
        .launch-feature { position: relative; overflow: hidden; background: var(--cream); border-bottom: 1px solid var(--line); padding: 128px 0 0 0; } /* 64px clears the fixed navbar, as the hero does */
        .lf-inner { max-width: 1440px; margin: 0 auto; display: grid; grid-template-columns: 1fr 480px; gap: 48px; align-items: end; padding: 0 64px; }
        .lf-copy { padding-bottom: 64px; }
        .lf-title { font-family: var(--display); font-weight: 700; font-size: clamp(40px, 5.2vw, 88px); line-height: 1.02; letter-spacing: -0.02em; color: var(--ink); margin: 0; }
        .lf-title em { display: block; font-style: italic; color: var(--burgundy-text); }
        .lf-sub { font-family: var(--sans); font-size: 20px; line-height: 1.55; color: var(--ink-soft); max-width: 40ch; margin: 24px 0 0; }
        .lf-sub strong { color: var(--ink); font-weight: 600; }
        .lf-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; margin-top: 32px; }
        .lf-cta { display: inline-flex; align-items: center; gap: 10px; min-height: 52px; padding: 0 28px; border-radius: 12px; background: var(--burgundy); color: var(--panel-cream); font-family: var(--sans); font-weight: 600; font-size: 18px; text-decoration: none; transition: background-color 160ms ease; }
        .lf-cta:hover { background: var(--burgundy-dk); }
        .lf-cta:focus-visible { outline: 2px solid var(--burgundy); outline-offset: 3px; }
        .lf-chip { display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 999px; border: 1px solid var(--line); color: var(--ink-soft); font-family: var(--sans); font-weight: 500; font-size: 15px; }
        .lf-arch-wrap { position: relative; padding: 20px 20px 0; }
        .lf-arch-wrap::before { content: ''; position: absolute; inset: 0 0 0 0; border: 2px solid var(--gold); border-bottom: none; border-radius: 260px 260px 0 0; }
        .lf-arch { position: relative; height: 520px; background: var(--burgundy); color: var(--panel-cream); border-radius: 240px 240px 0 0; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; padding-bottom: 48px; text-align: center; }
        .lf-day { font-family: var(--display); font-style: italic; font-weight: 500; font-size: 220px; line-height: 1; letter-spacing: -0.04em; }
        .lf-month { font-family: var(--display); font-weight: 500; font-size: 42px; margin-top: 8px; }
        .lf-rule { width: 96px; height: 1px; background: var(--line-on-dk); margin: 20px 0 16px; }
        .lf-note { font-family: var(--sans); font-weight: 500; font-size: 16px; padding: 0 24px; color: var(--gold-lt); }
        html.elder .launch-feature .lf-sub { font-size: 1.3rem !important; }
        html.elder .lf-cta { min-height: 56px; font-size: 1.15rem; }
        html.elder .lf-chip, html.elder .lf-note { font-size: 1.05rem; }
        @media (max-width: 1000px) {
          .launch-feature { padding-top: 104px; }
          .lf-inner { grid-template-columns: 1fr; gap: 32px; padding: 0 20px; }
          .lf-copy { padding-bottom: 0; }
          .lf-arch-wrap { width: min(360px, 100%); margin: 0 auto; }
          .lf-arch { height: 380px; padding-bottom: 32px; }
          .lf-day { font-size: 150px; }
          .lf-month { font-size: 32px; }
          .lf-sub { font-size: 18px; }
        }
        @media (max-width: 420px) {
          .lf-inner { padding: 0 16px; }
          .lf-cta { width: 100%; justify-content: center; }
          .lf-arch { height: 320px; }
          .lf-day { font-size: 120px; }
        }
      `}</style>

      <div className="lf-inner">
        <div className="lf-copy">
          <h2 id="launch-feature-title" className="lf-title">
            {before
              ? <>{t('launch.titleBefore')}<em>{t('launch.titleBeforeDate', { date: dateLabel })}</em></>
              : <>{t('launch.titleOpen')}<em>{t('launch.titleOpenEm')}</em></>}
          </h2>
          <p className="lf-sub">
            {before ? t('launch.subBefore', { weekday }) : t('launch.subOpen')}{' '}
            <strong>{t('launch.subStrong')}</strong>
          </p>
          <div className="lf-actions">
            <Link to="/onboarding" className="lf-cta">
              {before ? t('launch.ctaBefore') : t('launch.ctaOpen')}
              <FiArrowRight aria-hidden="true" />
            </Link>
            <span className="lf-chip"><FiCheckCircle aria-hidden="true" />{t('launch.chip')}</span>
          </div>
        </div>

        {/* Decorative restatement of the date already in the heading. */}
        <div className="lf-arch-wrap" aria-hidden="true">
          <div className="lf-arch">
            <span className="lf-day">{dayNum}</span>
            <span className="lf-month">{monthName} {year}</span>
            <span className="lf-rule" />
            <span className="lf-note">{t('launch.note', { weekday })}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
