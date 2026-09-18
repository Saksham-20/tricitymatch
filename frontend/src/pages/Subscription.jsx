import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { track, STAGES } from '../utils/analytics';
import { motion, useScroll, useMotionValueEvent } from 'framer-motion';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { FiCheck, FiX, FiArrowRight, FiZap, FiShield, FiClock, FiGlobe, FiPlusCircle, FiStar, FiInfo } from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import { razorpay } from '../config';
import { loadRazorpayScript, ensurePaymentsAvailable } from '../utils/razorpayCheckout';
import { useAuth } from '../context/AuthContext';
import { detectCurrency, formatLocalPrice } from '../utils/currency';
import { planFeatures } from '../utils/planFeatures';
import { EmptyState, ErrorState, Skeleton } from '../components/ui';
import { fadeRise, fade, staggerIndex } from '../utils/animations';

// Gate `whileHover` behind a real pointer (doctrine §8): a touch tap on a
// hover-capable-looking card should not fire a hover animation that then
// never un-fires cleanly on mobile.
const HOVER_CAPABLE = typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// ─── Plan card config ─────────────────────────
// accent: 'primary' (burgundy) | 'gold' (premium/VIP only) | 'neutral'
const PLAN_CONFIG = {
  free:           { label: 'Free',    accent: 'neutral', icon: null,     cta: 'Free forever' },
  basic_premium:  { label: 'Basic',   accent: 'primary', icon: FiZap,    cta: 'Get Basic',   duration: '30 days',  price: 1299 },
  premium_plus:   { label: 'Premium', accent: 'primary', icon: FaCrown,  cta: 'Get Premium', duration: '90 days',  price: 2499 },
  elite:          { label: 'Elite',   accent: 'gold',    icon: FiShield, cta: 'Get Elite',   duration: '6 months', price: 3999 },
  vip:            { label: 'VIP',     accent: 'gold',    icon: FaCrown,  cta: 'Get VIP',      duration: '12 months', price: 5999 },
  nri:            { label: 'NRI Connect', accent: 'gold', icon: FiGlobe, cta: 'Get NRI Connect', duration: '6 months', price: 9999 },
};

// Every tier that MAY appear in the main comparison grid (NRI gets its own
// block). Which of these actually render is decided by the server: the launch
// offer can withdraw a tier, and a withdrawn tier is refused at checkout, so
// rendering a card for one would be an advertised price the server won't take.
const GRID_KEYS = ['free', 'basic_premium', 'premium_plus', 'elite', 'vip'];

// Desktop column count, derived from how many cards actually render. Hardcoding
// `lg:grid-cols-5` left a dead column the day a tier was withdrawn. Tailwind
// needs whole class names to survive its scanner, hence the lookup.
const GRID_COLS = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
};

// À-la-carte contact-unlock top-ups. FALLBACK ONLY — the live list (prices and
// which bundles are on sale at all) comes from GET /subscription/plans, because
// the launch offer can reprice a bundle or withdraw it entirely, and a
// hardcoded card would advertise a price the server refuses to charge.
const BUNDLES_FALLBACK = [
  { bundleId: 'bundle_3',  unlocks: 3,  price: 599 },
  { bundleId: 'bundle_10', unlocks: 10, price: 1499 },
  { bundleId: 'bundle_25', unlocks: 25, price: 3499 },
];

// Tier order — a member can only move UP while a paid plan is active (mirrors
// the backend createOrder rule). Lower/equal paid tiers show as "Included".
// nri === vip rank (parallel premium).
// founding_premium is rank 0 (a granted free-premium — holders can buy any
// paid tier), matching backend TIER_RANK; the old `?? 0` fallback only
// happened to be right.
const TIER_RANK = { free: 0, founding_premium: 0, basic_premium: 1, premium_plus: 2, elite: 3, vip: 4, nri: 4 };

// ─── Long-scroll paywall sections (B6) ─────────────────────────
// Comparison matrix — DS11: real table ≥640px, per-plan accordion below.
// The unlock row is FILLED FROM THE LIVE PLANS (see ComparisonSection) — the
// launch offer moves those caps, and a frozen row here contradicted the cards
// sitting directly above it.
// Capabilities are keyed BY TIER, not positional. A positional array silently
// mis-labels every column the moment a tier is withdrawn — and it also forced
// the table to render a column for a plan the server refuses to sell.
const COMPARE_ROWS = [
  { label: 'Contact unlocks', unlocks: true },
  { label: 'Chat with matches', by: { free: false, basic_premium: true, premium_plus: true, elite: true, vip: true } },
  { label: 'See who likes you', by: { free: false, basic_premium: true, premium_plus: true, elite: true, vip: true } },
  { label: 'Reactions, voice notes & quote replies', by: { free: false, basic_premium: true, premium_plus: true, elite: true, vip: true } },
  { label: 'Advanced filters', by: { free: false, basic_premium: true, premium_plus: true, elite: true, vip: true } },
  { label: 'Voice & video calls', by: { free: false, basic_premium: false, premium_plus: true, elite: true, vip: true } },
  // Premium DOES carry profile boost — backend PLANS.premium_plus lists
  // `profile_boost`, and searchController's premiumBoost() gives it +10 in the
  // ranking. This row said otherwise, so the table contradicted the card sitting
  // directly above it (which reads "Profile boost" from the same server data).
  { label: 'Profile boost', by: { free: false, basic_premium: false, premium_plus: true, elite: true, vip: true } },
  { label: 'Relationship manager', by: { free: false, basic_premium: false, premium_plus: false, elite: false, vip: true } },
];
const COMPARE_LABELS = {
  free: 'Free',
  basic_premium: 'Basic',
  // Matches the card heading and the server's plan name. 'Plus' read as a
  // different product the moment the two sat side by side.
  premium_plus: 'Premium',
  elite: 'Elite',
  vip: 'VIP',
};

const CompareCell = ({ v }) => (
  typeof v === 'boolean'
    ? (v ? <FiCheck className="w-4 h-4 text-success mx-auto" aria-label="Included" /> : <span className="text-neutral-300 dark:text-neutral-600" aria-label="Not included">—</span>)
    : <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">{v}</span>
);

const ComparisonSection = ({ plans = {}, planKeys = [] }) => {
  // Columns are exactly the tiers rendered as cards above, so the table can
  // never offer a comparison for something that isn't on sale.
  const cols = planKeys.filter((k) => COMPARE_LABELS[k]);
  const [openCol, setOpenCol] = useState(Math.max(0, cols.length - 1));

  const unlockCell = (key) => {
    if (key === 'free') return '0';
    const v = plans?.[key]?.contactUnlocks;
    if (v === -1) return 'Unlimited';
    if (typeof v === 'number') return String(v);
    return '—';
  };
  const rows = COMPARE_ROWS
    .map((row) => ({
      ...row,
      values: cols.map((key) => (row.unlocks ? unlockCell(key) : Boolean(row.by?.[key]))),
    }))
    // Drop a row no VISIBLE plan offers. With the full ladder up, "Relationship
    // manager" separates VIP from the rest; with VIP withdrawn it is a line of
    // dashes telling the reader about a thing nobody can buy.
    .filter((row) => row.unlocks || row.values.some(Boolean));

  if (cols.length === 0) return null;

  return (
    <section className="mt-14" aria-labelledby="compare-heading">
      <h2 id="compare-heading" className="font-display text-2xl font-bold text-neutral-900 dark:text-neutral-100 text-center mb-6">Compare plans</h2>
      {/* Table ≥ sm. Border only (doctrine §3.4: elevation declared once) —
          matches the accordion variant below it, which already carried just
          a border. */}
      <div className="hidden sm:block overflow-x-auto rounded-2xl border border-neutral-100 dark:border-neutral-800 bg-white dark:bg-surface-dark-3">
        <table className="w-full text-center">
          <thead>
            <tr className="border-b border-neutral-100 dark:border-neutral-800">
              <th className="py-3 px-4 text-left text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">Feature</th>
              {cols.map((key) => (
                <th key={key} className="py-3 px-3 text-xs font-bold text-neutral-700 dark:text-neutral-200">{COMPARE_LABELS[key]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-neutral-50 dark:border-neutral-800/60 last:border-0">
                <td className="py-3 px-4 text-left text-sm text-neutral-600 dark:text-neutral-300">{row.label}</td>
                {row.values.map((v, i) => <td key={i} className="py-3 px-3"><CompareCell v={v} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Accordion < sm */}
      <div className="sm:hidden space-y-2">
        {cols.map((key, ci) => (
          <div key={key} className="rounded-2xl border border-neutral-100 dark:border-neutral-800 bg-white dark:bg-surface-dark-3 overflow-hidden">
            <button
              onClick={() => setOpenCol(openCol === ci ? -1 : ci)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-neutral-800 dark:text-neutral-100"
              aria-expanded={openCol === ci}
            >
              {COMPARE_LABELS[key]}
              <span className="text-neutral-400 dark:text-neutral-500">{openCol === ci ? '−' : '+'}</span>
            </button>
            {openCol === ci && (
              <ul className="px-4 pb-3 space-y-1.5">
                {rows.map((row) => (
                  <li key={row.label} className="flex items-center justify-between text-sm">
                    <span className="text-neutral-600 dark:text-neutral-300">{row.label}</span>
                    <CompareCell v={row.values[ci]} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

const SuccessStrip = () => {
  const [stories, setStories] = useState(null);
  useEffect(() => {
    api.get('/success-stories')
      .then((res) => setStories((res.data.stories || res.data.successStories || []).slice(0, 3)))
      .catch(() => setStories([]));
  }, []);
  if (!stories || stories.length === 0) return null;
  return (
    <section className="mt-14" aria-labelledby="stories-heading">
      <h2 id="stories-heading" className="font-display text-2xl font-bold text-neutral-900 dark:text-neutral-100 text-center mb-6">Matches that became marriages</h2>
      <div className="grid sm:grid-cols-3 gap-4">
        {stories.map((st) => (
          <figure key={st.id} className="rounded-2xl bg-white dark:bg-surface-dark-3 shadow-card p-5">
            <blockquote className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed line-clamp-4">“{st.story || st.content || ''}”</blockquote>
            <figcaption className="mt-3 text-sm font-semibold text-primary-700 dark:text-primary-400">{st.coupleNames || st.title || 'A TricityMatch couple'}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
};

// `unlockDailyCap` is threaded in from the live plans response (never
// hardcoded) — the anti-harvest ceiling is a config value and a frozen
// number here would silently drift from what the server actually enforces.
const FAQS = (unlockDailyCap) => [
  { q: 'Can I upgrade later?', a: 'Yes. You can move up to a higher plan any time while your current plan is active. The new plan starts fresh from the day you upgrade.' },
  { q: 'Is my payment secure?', a: 'All payments run through Razorpay over SSL. We never see or store your card details.' },
  { q: 'What are contact unlocks?', a: unlockDailyCap ? `Each unlock reveals a member\u2019s phone number so your families can talk directly. Unlimited-tier plans are capped at ${unlockDailyCap} unlocks a day, to keep the directory safe from bulk scraping.` : 'Each unlock reveals a member\u2019s phone number so your families can talk directly.' },
  { q: 'Do unused days carry over?', a: 'Upgrading starts a full fresh term on the new plan; remaining days on the old plan are not added on top.' },
  { q: 'Can my parents manage this account?', a: 'Yes. The Guardian feature lets a family member view matches and shortlists for you.' },
];

const FaqSection = ({ unlockDailyCap }) => {
  const [open, setOpen] = useState(0);
  const faqs = FAQS(unlockDailyCap);
  return (
    <section className="mt-14 max-w-2xl mx-auto" aria-labelledby="faq-heading">
      <h2 id="faq-heading" className="font-display text-2xl font-bold text-neutral-900 dark:text-neutral-100 text-center mb-6">Common questions</h2>
      <div className="space-y-2">
        {faqs.map((f, i) => (
          <div key={f.q} className="rounded-2xl border border-neutral-100 dark:border-neutral-800 bg-white dark:bg-surface-dark-3 overflow-hidden">
            <button
              onClick={() => setOpen(open === i ? -1 : i)}
              className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-semibold text-neutral-800 dark:text-neutral-100"
              aria-expanded={open === i}
            >
              {f.q}
              <span className="text-neutral-400 dark:text-neutral-500 ml-3 flex-shrink-0">{open === i ? '−' : '+'}</span>
            </button>
            {open === i && <p className="px-5 pb-4 text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">{f.a}</p>}
          </div>
        ))}
      </div>
    </section>
  );
};

// DS11: sticky compact CTA bar on mobile after the first fold (free members).
const StickyCtaBar = ({ show }) => {
  const [pastFold, setPastFold] = useState(false);
  // Doctrine §8: no raw `addEventListener('scroll')`. framer-motion's
  // `useScroll` (already the pattern in Navbar.jsx) tracks scrollY without a
  // manual listener.
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, 'change', (latest) => setPastFold(latest > 640));
  if (!show || !pastFold) return null;
  return (
    <div className="sm:hidden fixed bottom-20 inset-x-4 z-40">
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="w-full flex items-center justify-center gap-2 min-h-[48px] rounded-full bg-gradient-hero text-white text-sm font-bold shadow-burgundy-lg"
      >
        <FaCrown className="w-4 h-4 text-gold-300" /> View plans
      </button>
    </div>
  );
};

// Which button state a plan CTA is in — used by PlanCard AND the 2-card
// overlap pair below, so "can this tier be bought right now" is computed in
// exactly one place. On a paid plan, only strictly higher tiers are
// purchasable (as upgrades); lower/equal paid tiers already included.
const getPlanCtaState = (planKey, currentPlanType, isCurrent, isProcessing) => {
  const free = planKey === 'free';
  const currentRank = TIER_RANK[currentPlanType] ?? 0;
  const thisRank = TIER_RANK[planKey] ?? 0;
  const onPaidPlan = currentRank > 0;
  const isUpgrade = onPaidPlan && thisRank > currentRank;
  const isIncluded = onPaidPlan && !isCurrent && !free && thisRank < currentRank;
  const disabled = isCurrent || free || isIncluded || isProcessing;
  return { isUpgrade, isIncluded, disabled };
};

// ─── Single plan card ─────────────────────────
const PlanCard = ({ planKey, plan, prevName, isPopular, isCurrent, currentPlanType, isProcessing, freeChatForMutuals, onSubscribe, entranceDelay = 0 }) => {
  const cfg = PLAN_CONFIG[planKey] || PLAN_CONFIG.free;
  const Icon = cfg.icon;
  const features = planFeatures(planKey, freeChatForMutuals, plan, prevName);
  const free = planKey === 'free';
  const gold = cfg.accent === 'gold';
  const displayPrice = plan.price || cfg.price || 0;
  const mrp = plan.mrp || null;
  const perMonth = plan.perMonth || null;
  const discountPct = mrp && mrp > displayPrice ? Math.round(((mrp - displayPrice) / mrp) * 100) : 0;

  const { isUpgrade, isIncluded, disabled } = getPlanCtaState(planKey, currentPlanType, isCurrent, isProcessing);

  const badge = plan.badge || (isPopular ? 'Most Popular' : null);

  return (
    <motion.div
      initial={fadeRise.initial}
      animate={{ ...fadeRise.animate, transition: { ...fadeRise.animate.transition, delay: entranceDelay } }}
      whileHover={HOVER_CAPABLE && !free && !isCurrent ? { y: -6 } : {}}
      // Doctrine §3.4: elevation declared once — shadow carries it, no border
      // or ring stacked on top (the accent bar + badge above already signal
      // the popular/gold tiers without a second and third elevation layer).
      className={`relative flex flex-col bg-white dark:bg-surface-dark-3 rounded-2xl transition-[box-shadow,transform] duration-200 overflow-hidden ${
        isPopular
          ? 'shadow-burgundy-lg scale-[1.03]'
          : gold
          ? 'shadow-gold'
          : 'shadow-card'
      }`}
    >
      {/* Accent bar + badge ribbon */}
      {isPopular && (
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary-500 to-primary-700 rounded-t-2xl" />
      )}
      {gold && !isPopular && (
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-gold-400 to-gold-600 rounded-t-2xl" />
      )}
      {badge && (
        // whitespace-nowrap: in a five-column grid the ribbon wrapped to two
        // lines and overlapped the plan title underneath it.
        <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-[11px] sm:text-xs font-semibold rounded-b-xl ${
            isPopular
              ? 'bg-primary-500 text-white shadow-burgundy'
              : 'bg-gold text-neutral-900 shadow-gold'
          }`}>
            {isPopular ? <FiZap className="w-3 h-3" /> : <FaCrown className="w-3 h-3" />}
            {badge}
          </span>
        </div>
      )}

      {/* Header */}
      <div className={`px-6 pt-8 pb-6 ${badge ? 'pt-12' : ''}`}>
        <div className="flex items-center gap-2.5 mb-4">
          {Icon && (
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              gold ? 'bg-gold-50 dark:bg-gold-900/20 text-gold'
              : planKey === 'premium_plus' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
              : 'bg-primary-50 dark:bg-primary-900/20 text-primary-500 dark:text-primary-400'
            }`}>
              <Icon className="w-4 h-4" />
            </div>
          )}
          <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">{plan.name || cfg.label}</h3>
          {isCurrent && (
            <span className="ml-auto px-2 py-0.5 bg-success-50 dark:bg-success/15 border border-success-100 dark:border-success/30 text-success text-[10px] font-bold rounded-full uppercase tracking-wide">
              Active
            </span>
          )}
        </div>

        {/* Price + MRP anchor */}
        <div className="flex items-baseline gap-1.5 mb-1 flex-wrap">
          <span className={`text-4xl font-bold ${
            gold ? 'text-gold-600 dark:text-gold-400'
            : planKey === 'premium_plus' || planKey === 'basic_premium' ? 'text-primary-500 dark:text-primary-400'
            : 'text-neutral-700 dark:text-neutral-200'
          }`}>
            {displayPrice > 0 ? `₹${displayPrice.toLocaleString('en-IN')}` : 'Free'}
          </span>
          {displayPrice > 0 && (
            <span className="text-sm text-neutral-500 dark:text-neutral-400">/{plan.duration || cfg.duration}</span>
          )}
        </div>
        {displayPrice > 0 && (mrp || perMonth) && (
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {mrp && mrp > displayPrice && (
              <span className="text-sm text-neutral-400 dark:text-neutral-500 line-through">₹{mrp.toLocaleString('en-IN')}</span>
            )}
            {discountPct > 0 && (
              <span className="text-[11px] font-bold text-success bg-success-50 dark:bg-success/15 border border-success-100 dark:border-success/30 px-1.5 py-0.5 rounded">
                {plan.isLaunchPrice ? `Launch price · ${discountPct}% off` : `Flat ${discountPct}% off`}
              </span>
            )}
            {perMonth && (
              <span className="text-xs text-neutral-400 dark:text-neutral-500">≈ ₹{perMonth.toLocaleString('en-IN')}/month</span>
            )}
            {plan.durationDays > 0 && displayPrice > 0 && (
              <span className="text-xs text-neutral-400 dark:text-neutral-500">· ₹{Math.max(1, Math.round(displayPrice / plan.durationDays))}/day</span>
            )}
          </div>
        )}
        {displayPrice > 0 && plan.contactUnlocks != null && (
          <p className="text-xs text-primary-500 dark:text-primary-400 font-medium mt-1">
            {plan.contactUnlocks === -1 ? '∞ Unlimited' : plan.contactUnlocks} contact unlocks
            {/* Fact, not a restriction: "unlimited" is capped in practice at a
                rolling-24h ceiling (anti-harvest). Stated plainly beside the
                benefit it qualifies, not buried in a FAQ. */}
            {plan.contactUnlocks === -1 && plan.unlockDailyCap != null && (
              <span className="text-neutral-400 dark:text-neutral-500 font-normal"> · up to {plan.unlockDailyCap}/day</span>
            )}
          </p>
        )}
      </div>

      {/* Feature list */}
      <div className="flex-1 px-6 pb-6">
        <ul className="space-y-2.5">
          {features.map((f, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                gold ? 'bg-gold-100 dark:bg-gold-900/30 text-gold-700 dark:text-gold-400' :
                planKey === 'premium_plus' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' :
                planKey === 'basic_premium' ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-500 dark:text-primary-400' :
                'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
              }`}>
                <FiCheck className="w-2.5 h-2.5" />
              </div>
              <span className="text-sm text-neutral-700 dark:text-neutral-300 leading-snug">{f}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <div className="px-6 pb-6">
        <button
          onClick={() => !disabled && onSubscribe(planKey)}
          disabled={disabled}
          aria-busy={isProcessing || undefined}
          className={`w-full py-3 text-sm font-semibold rounded-xl transition-[background-color,box-shadow,transform] duration-200 flex items-center justify-center gap-2 disabled:cursor-not-allowed ${
            isCurrent || free || isIncluded
              ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 cursor-default'
              : gold
              ? 'bg-gold text-neutral-900 hover:bg-gold-400 shadow-gold hover:-translate-y-0.5'
              : 'bg-primary-500 text-white hover:bg-primary-600 shadow-burgundy hover:-translate-y-0.5'
          } ${isProcessing ? 'opacity-70' : ''}`}
        >
          {isProcessing
            ? <><span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" /> Processing…</>
            : isCurrent
            ? <><FiCheck className="w-4 h-4" /> Current Plan</>
            : free
            ? 'Free forever'
            : isIncluded
            ? <><FiCheck className="w-4 h-4" /> Included</>
            : isUpgrade
            ? <>Upgrade <FiArrowRight className="w-4 h-4" /></>
            : <>{cfg.cta} <FiArrowRight className="w-4 h-4" /></>}
        </button>
      </div>
    </motion.div>
  );
};

// ─── Free/Paid overlap pair ─────────────────────────────────────────────
// Doctrine's fix for "two peer cards": a single-plan catalogue rendered as
// Free and Premium side by side as equal-weight cards undersells the paid
// tier. Both cards list the SAME rows — Free is muted with a cross against
// whatever it lacks, Paid is raised and physically overlaps it. Only makes
// sense for exactly two cards; the caller falls back to the grid otherwise.
const OverlapPricingPair = ({ freeEntry, paidEntry, currentPlanType, isCurrentPaid, isProcessing, freeChatForMutuals, onSubscribe }) => {
  const [, freePlan] = freeEntry;
  const [paidKey, paidPlan] = paidEntry;
  const paidCfg = PLAN_CONFIG[paidKey] || PLAN_CONFIG.free;
  const PaidIcon = paidCfg.icon;
  const gold = paidCfg.accent === 'gold';

  // Same row source PlanCard uses (`planFeatures`) — never a second,
  // hand-typed list. "Everything in Free" is expanded into Free's own rows
  // rather than shown as a placeholder, since there is no tier between them.
  const freeFeatures = planFeatures('free', freeChatForMutuals, freePlan, null);
  const paidFeaturesRaw = planFeatures(paidKey, freeChatForMutuals, paidPlan, 'Free');
  const rows = [
    ...freeFeatures.map((label) => ({ label, free: true })),
    ...paidFeaturesRaw
      .filter((label) => !/^Everything in/i.test(label))
      .filter((label) => !freeFeatures.includes(label))
      .map((label) => ({ label, free: false })),
  ];

  const { isUpgrade, isIncluded, disabled } = getPlanCtaState(paidKey, currentPlanType, isCurrentPaid, isProcessing);
  // The server ALWAYS resolves a free member's subscription to the synthetic
  // `{planType:'free', status:'active'}` row (see getMySubscription) — so a
  // visitor with no paid plan is the common case here, not an edge case, and
  // the Free card has to say "Current plan", not "Free forever", for them.
  // `currentPlanType` already carries this (falls back to 'free' the same
  // way `PlanCard`'s own `isCurrent` check does for the free key).
  const isCurrentFree = currentPlanType === 'free';
  const displayPrice = paidPlan.price || paidCfg.price || 0;
  const mrp = paidPlan.mrp || null;
  const perMonth = paidPlan.perMonth || null;
  const discountPct = mrp && mrp > displayPrice ? Math.round(((mrp - displayPrice) / mrp) * 100) : 0;
  const accentText = gold ? 'text-gold-600 dark:text-gold-400' : 'text-primary-500 dark:text-primary-400';
  const accentIconBg = gold ? 'bg-gold-50 dark:bg-gold-900/20 text-gold' : 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400';
  const accentCheckBg = gold ? 'bg-gold-100 dark:bg-gold-900/30 text-gold-700 dark:text-gold-400' : 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400';
  const accentButton = gold ? 'bg-gold text-neutral-900 hover:bg-gold-400 shadow-gold hover:-translate-y-0.5' : 'bg-primary-500 text-white hover:bg-primary-600 shadow-burgundy hover:-translate-y-0.5';

  return (
    <motion.div {...fadeRise} className="relative mx-auto max-w-sm sm:max-w-none sm:flex sm:justify-center sm:items-start pt-4 pb-6">
      {/* Free — full row list, muted, sits behind. Background is `bg-neutral-50`
          ONLY — index.css already forces `html.dark .bg-neutral-50` to the
          page-canvas tier (`surface-dark-1`, the darkest of the three), which
          is the right muted/recede effect in dark mode too; a `dark:bg-*`
          class here would just be dead weight under that `!important` rule. */}
      <div className="relative z-0 flex flex-col rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 p-6 sm:w-72 sm:flex-shrink-0 sm:p-7 sm:pt-8 sm:mr-[-1.75rem]">
        <div className="flex items-center gap-2.5">
          <h3 className="text-base font-bold text-neutral-600 dark:text-neutral-400">{freePlan.name || PLAN_CONFIG.free.label}</h3>
          {isCurrentFree && (
            <span className="ml-auto px-2 py-0.5 bg-success-50 dark:bg-success/15 border border-success-100 dark:border-success/30 text-success text-[10px] font-bold rounded-full uppercase tracking-wide">
              Active
            </span>
          )}
        </div>
        <p className="mt-2 text-3xl font-bold text-neutral-500 dark:text-neutral-500">Free</p>
        <p className="text-sm text-neutral-600 dark:text-neutral-500 mb-5">Forever, no card needed</p>
        <ul className="space-y-2.5 mb-6 flex-1">
          {rows.map((row) => (
            <li key={row.label} className="flex items-start gap-2.5">
              {/* Muted is the card's own weight (grey icons, no accent, no
                  shadow); which rows Free has is carried by the icon shape
                  alone, never by contrast, so both states stay readable. */}
              {row.free
                ? <FiCheck className="w-4 h-4 mt-0.5 text-neutral-500 dark:text-neutral-400 flex-shrink-0" aria-hidden="true" />
                : <FiX className="w-4 h-4 mt-0.5 text-neutral-500 dark:text-neutral-500 flex-shrink-0" aria-hidden="true" />}
              <span className="text-sm leading-snug text-neutral-600 dark:text-neutral-400">{row.label}</span>
            </li>
          ))}
        </ul>
        <button
          disabled
          className="w-full py-3 text-sm font-semibold rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 cursor-default flex items-center justify-center gap-2"
        >
          {isCurrentFree ? <><FiCheck className="w-4 h-4" /> Current plan</> : 'Free forever'}
        </button>
      </div>

      {/* Paid — same rows, raised and overlapping Free */}
      <div className={`relative z-10 flex flex-col overflow-hidden rounded-2xl bg-white dark:bg-surface-dark-3 p-6 sm:w-80 sm:flex-shrink-0 sm:p-7 sm:pt-8 -mt-6 mx-3 sm:mx-0 sm:-mt-4 sm:mb-[-1rem] ${
        gold ? 'shadow-gold-lg' : 'shadow-burgundy-lg'
      }`}>
        <div className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-r ${gold ? 'from-gold-400 to-gold-600' : 'from-primary-500 to-primary-700'}`} />
        <div className="flex items-center gap-2.5 mb-1">
          {PaidIcon && (
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${accentIconBg}`}>
              <PaidIcon className="w-4 h-4" />
            </div>
          )}
          <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">{paidPlan.name || paidCfg.label}</h3>
          {isCurrentPaid && (
            <span className="ml-auto px-2 py-0.5 bg-success-50 dark:bg-success/15 border border-success-100 dark:border-success/30 text-success text-[10px] font-bold rounded-full uppercase tracking-wide">
              Active
            </span>
          )}
        </div>

        <div className="flex items-baseline gap-1.5 mb-1 flex-wrap">
          <span className={`text-4xl font-bold ${accentText}`}>₹{displayPrice.toLocaleString('en-IN')}</span>
          <span className="text-sm text-neutral-500 dark:text-neutral-400">/{paidPlan.duration || paidCfg.duration}</span>
        </div>
        {(mrp || perMonth) && (
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {mrp && mrp > displayPrice && (
              <span className="text-sm text-neutral-400 dark:text-neutral-500 line-through">₹{mrp.toLocaleString('en-IN')}</span>
            )}
            {discountPct > 0 && (
              <span className="text-[11px] font-bold text-success bg-success-50 dark:bg-success/15 border border-success-100 dark:border-success/30 px-1.5 py-0.5 rounded">
                {paidPlan.isLaunchPrice ? `Launch price · ${discountPct}% off` : `Flat ${discountPct}% off`}
              </span>
            )}
            {perMonth && <span className="text-xs text-neutral-400 dark:text-neutral-500">≈ ₹{perMonth.toLocaleString('en-IN')}/month</span>}
          </div>
        )}
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-5">Everything in Free, plus</p>

        <ul className="space-y-2.5 mb-6 flex-1">
          {rows.map((row) => (
            <li key={row.label} className="flex items-start gap-2.5">
              <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${accentCheckBg}`}>
                <FiCheck className="w-2.5 h-2.5" />
              </div>
              <span className="text-sm text-neutral-700 dark:text-neutral-300 leading-snug">{row.label}</span>
            </li>
          ))}
        </ul>

        <button
          onClick={() => !disabled && onSubscribe(paidKey)}
          disabled={disabled}
          aria-busy={isProcessing || undefined}
          className={`w-full py-3 text-sm font-semibold rounded-xl transition-[background-color,box-shadow,transform] duration-200 flex items-center justify-center gap-2 disabled:cursor-not-allowed ${
            isCurrentPaid || isIncluded
              ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 cursor-default'
              : accentButton
          } ${isProcessing ? 'opacity-70' : ''}`}
        >
          {isProcessing
            ? <><span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" /> Processing…</>
            : isCurrentPaid
            ? <><FiCheck className="w-4 h-4" /> Current plan</>
            : isIncluded
            ? <><FiCheck className="w-4 h-4" /> Included</>
            : isUpgrade
            ? <>Upgrade <FiArrowRight className="w-4 h-4" /></>
            : <>{paidCfg.cta} <FiArrowRight className="w-4 h-4" /></>}
        </button>
      </div>
    </motion.div>
  );
};

// ─── NRI Connect block (own styled band, shown to everyone) ────────────
const NriBlock = ({ plan, topLadderName, currency, isCurrent, currentPlanType, isProcessing, onSubscribe }) => {
  const cfg = PLAN_CONFIG.nri;
  const price = plan?.price || cfg.price;
  const mrp = plan?.mrp || null;
  const discountPct = mrp && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
  const currentRank = TIER_RANK[currentPlanType] ?? 0;
  const isUnlimited = currentRank >= TIER_RANK.vip; // already on VIP/NRI-equivalent
  const disabled = isCurrent || isProcessing || isUnlimited;
  const local = currency && currency.code !== 'INR'
    ? formatLocalPrice(price, currency)
    : null;

  return (
    <motion.div
      {...fadeRise}
      // Doctrine §3.4: elevation declared once (shadow, not border+ring).
      // Doctrine §3.1/Phase 2: dark-gradient stops come from the committed
      // surface-dark-* ramp, not a one-off hex pair.
      className="mt-8 rounded-2xl bg-gradient-to-br from-white to-gold-50/40 dark:from-surface-dark-2 dark:to-surface-dark-3 shadow-gold overflow-hidden"
    >
      <div className="flex flex-col lg:flex-row lg:items-center gap-6 p-6 lg:p-8">
        <div className="flex-1">
          <h3 className="font-display text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-1.5">NRI Connect</h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-300 max-w-md mb-3">
            Full VIP access built for members abroad: timezone-aware matching, priority support,
            and prices shown in your own currency.
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
            {planFeatures('nri', false, plan, topLadderName).map((f, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                <FiCheck className="w-3.5 h-3.5 text-gold-600 dark:text-gold-400 flex-shrink-0" />{f}
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:w-64 flex-shrink-0 text-center lg:text-right">
          <div className="flex items-baseline justify-center lg:justify-end gap-1">
            <span className="text-4xl font-bold text-gold-600 dark:text-gold-400">₹{price.toLocaleString('en-IN')}</span>
            <span className="text-sm text-neutral-500 dark:text-neutral-400">/{plan?.duration || cfg.duration || '6 months'}</span>
          </div>
          {(mrp && mrp > price) && (
            <div className="flex items-center justify-center lg:justify-end gap-2 mt-1">
              <span className="text-sm text-neutral-400 dark:text-neutral-500 line-through">₹{mrp.toLocaleString('en-IN')}</span>
              {discountPct > 0 && (
                <span className="text-[11px] font-bold text-success bg-success-50 dark:bg-success/15 border border-success-100 dark:border-success/30 px-1.5 py-0.5 rounded">
                  {plan?.isLaunchPrice ? `Launch price · ${discountPct}% off` : `Flat ${discountPct}% off`}
                </span>
              )}
            </div>
          )}
          {local && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">≈ {local} <span className="text-neutral-400 dark:text-neutral-500">(indicative)</span></p>
          )}
          <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">Billed in INR</p>
          <button
            onClick={() => !disabled && onSubscribe('nri')}
            disabled={disabled}
            aria-busy={isProcessing || undefined}
            className={`mt-4 w-full py-3 text-sm font-semibold rounded-xl transition-[background-color,box-shadow,transform] duration-200 flex items-center justify-center gap-2 disabled:cursor-not-allowed ${
              isCurrent
                ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 cursor-default'
                : isUnlimited
                ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 cursor-default'
                : 'bg-gold text-neutral-900 hover:bg-gold-400 shadow-gold hover:-translate-y-0.5'
            }`}
          >
            {isProcessing
              ? <><span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" /> Processing…</>
              : isCurrent
              ? <><FiCheck className="w-4 h-4" /> Current Plan</>
              : isUnlimited
              ? 'Included in your plan'
              : <>Get NRI Connect <FiArrowRight className="w-4 h-4" /></>}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Contact-unlock top-up block (active finite-plan members only) ──────
const BundleBlock = ({ bundles, processingBundle, onBuy }) => (
  <motion.div
    {...fadeRise}
    className="mt-8 rounded-2xl border border-primary-200 dark:border-primary-800/40 bg-primary-50/50 dark:bg-primary-900/10 p-6 lg:p-8"
  >
    <div className="flex items-center gap-2.5 mb-1.5">
      <FiPlusCircle className="w-5 h-5 text-primary-600 dark:text-primary-400" />
      <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Need more contact unlocks?</h3>
    </div>
    <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-5 max-w-xl">
      Top up your current plan anytime. Unlocks add to your active plan and stay valid until it expires.
    </p>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {bundles.map((b) => {
        const perUnlock = Math.round(b.price / b.unlocks);
        const busy = processingBundle === b.bundleId;
        return (
          <div key={b.bundleId} className="flex flex-col bg-white dark:bg-surface-dark-3 rounded-xl p-5 shadow-card">
            <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{b.unlocks} <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">unlocks</span></p>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-lg font-semibold text-primary-600 dark:text-primary-400">₹{b.price.toLocaleString('en-IN')}</p>
              {b.mrp > b.price && (
                <span className="text-xs text-neutral-400 dark:text-neutral-500 line-through">₹{b.mrp.toLocaleString('en-IN')}</span>
              )}
            </div>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-4">₹{perUnlock} per unlock</p>
            <button
              onClick={() => !busy && onBuy(b.bundleId)}
              disabled={busy}
              aria-busy={busy || undefined}
              // No arbitrary `min-h` px floor: it doesn't grow with elder mode's
              // rem-based font scaling and undershoots the 48px elder target.
              // `py-3` (like the other plan CTAs) clears 44px at base and ~51px
              // under html.elder on its own.
              className="mt-auto w-full py-3 text-sm font-semibold rounded-lg bg-primary-500 text-white hover:bg-primary-600 shadow-burgundy transition-[background-color,box-shadow,transform] duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {busy
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing…</>
                : <>Buy <FiArrowRight className="w-4 h-4" /></>}
            </button>
          </div>
        );
      })}
    </div>
  </motion.div>
);

// ─── Launch-offer banner ───────────────────────────────────────────────
// Renders only while the server says an offer is live. `endsAt` is shown as a
// plain day count, not a ticking timer: a countdown that keeps running after
// the offer lapses is worse than no countdown, and the server is the clock.
const LaunchBanner = ({ offer }) => {
  if (!offer?.active) return null;

  const daysLeft = offer.endsAt
    ? Math.max(0, Math.ceil((new Date(offer.endsAt) - Date.now()) / 86400000))
    : null;

  return (
    <motion.div
      {...fadeRise}
      className="mb-8 rounded-2xl border border-gold-200 dark:border-gold-800/40 bg-gold-50 dark:bg-gold-900/10 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3"
    >
      <div className="w-9 h-9 rounded-full bg-gold flex items-center justify-center flex-shrink-0">
        <FaCrown className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-bold text-gold-800 dark:text-gold-300">
          {offer.headline || 'Launch offer'}
          {daysLeft !== null && (
            <span className="ml-2 font-semibold text-gold-700 dark:text-gold-400">
              · {daysLeft === 0 ? 'ends today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
            </span>
          )}
        </p>
        {offer.subline && <p className="text-sm text-gold-700/80 dark:text-gold-400/80 mt-0.5">{offer.subline}</p>}
      </div>
      {offer.endsAt && (
        <p className="text-xs text-gold-700/70 dark:text-gold-400/70 sm:text-right">
          Prices return to normal on {new Date(offer.endsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      )}
    </motion.div>
  );
};

// ─── Founding-member band ──────────────────────────────────────────────
// Two honest states, never a third. A member who HOLDS the grant is told what
// they hold and when it lapses; a member who can still take a place is offered
// it. Anyone else — already paying, already claimed and expired, window closed
// — sees nothing, because the alternative is advertising an entitlement the
// server would refuse. `canClaimFounding` is decided server-side for exactly
// that reason (see backend withDerivedUserFields).
const FoundingBand = ({ user, founding, currentSub, onClaim, claiming }) => {
  const holdsGrant = currentSub?.planType === 'founding_premium' && currentSub?.status === 'active';
  const canClaim = Boolean(user?.features?.canClaimFounding);

  if (!holdsGrant && !canClaim) return null;

  const unlocks = founding?.contactUnlocks ?? null;
  const days = founding?.grantDays ?? null;

  return (
    <motion.div
      {...fadeRise}
      className="mb-8 rounded-2xl border border-gold-200 dark:border-gold-800/40 bg-gold-50 dark:bg-gold-900/10 px-5 py-5 flex flex-col sm:flex-row sm:items-center gap-4"
    >
      <div className="w-10 h-10 rounded-full bg-gold flex items-center justify-center flex-shrink-0">
        <FiStar className="w-5 h-5 text-white" />
      </div>

      {holdsGrant ? (
        <div className="flex-1">
          <p className="text-sm font-bold text-gold-800 dark:text-gold-300">You are a founding member</p>
          <p className="text-sm text-gold-700/80 dark:text-gold-400/80 mt-0.5">
            Premium is on us
            {currentSub?.endDate && ` until ${new Date(currentSub.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
            . Pick a plan below whenever you want to carry on past that.
          </p>
        </div>
      ) : (
        <>
          <div className="flex-1">
            <p className="text-sm font-bold text-gold-800 dark:text-gold-300">
              Founding offer{days ? `: ${days} days of premium, free` : ': premium, free'}
            </p>
            <p className="text-sm text-gold-700/80 dark:text-gold-400/80 mt-0.5">
              You joined early enough to claim a place.
              {unlocks !== null && ` Includes ${unlocks} contact unlock${unlocks === 1 ? '' : 's'}.`}
              {' '}No card, no auto-renewal.
            </p>
          </div>
          <button
            onClick={onClaim}
            disabled={claiming}
            aria-busy={claiming || undefined}
            // No arbitrary `min-h` px floor (same elder-mode fix as
            // BundleBlock's Buy button): `py-3` clears 48px under html.elder
            // on its own.
            className="px-6 py-3 text-sm font-semibold rounded-xl bg-gold text-primary-900 hover:bg-gold-600 shadow-sm transition-colors duration-[160ms] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed flex-shrink-0"
          >
            {claiming
              ? <><span className="w-4 h-4 border-2 border-primary-900/30 border-t-primary-900 rounded-full animate-spin" /> Claiming…</>
              : <>{days ? `Claim ${days} days free` : 'Claim my free premium'} <FiArrowRight className="w-4 h-4" /></>}
          </button>
        </>
      )}
    </motion.div>
  );
};

// ─────────────────────────────────────────────
const Subscription = () => {
  const { user, checkAuth } = useAuth();
  // Server-owned flag (see backend withDerivedUserFields). Absent ⇒ false, so
  // an older/failed /auth/me payload shows the paid-chat copy — the
  // conservative direction: it under-promises rather than advertising a free
  // feature the server would refuse.
  const freeChatForMutuals = Boolean(user?.features?.freeChatForMutuals);
  const [plans, setPlans] = useState({});
  // Did the plans request actually come back? The grid falls back to the static
  // PLAN_CONFIG ladder ONLY when it did not. Sniffing for specific keys instead
  // (the old `plans.basic_premium || plans.premium_plus || plans.vip`) broke the
  // moment an admin withdrew exactly those three: the sniff read false, the
  // fallback fired, and the page resurrected every card the server had just
  // taken off sale — at hardcoded prices checkout refuses.
  const [plansLoaded, setPlansLoaded] = useState(false);
  const [bundles, setBundles] = useState(BUNDLES_FALLBACK);
  // Launch-offer state is server-owned and defaults to inactive, so a failed
  // load shows regular pricing with no discount claim rather than promising an
  // offer that checkout would not honour.
  const [launchOffer, setLaunchOffer] = useState({ active: false });
  // Founding-window state (grant length + unlock count). Server-owned and
  // fail-closed for the same reason as launchOffer.
  const [founding, setFounding] = useState({ open: false });
  const [claimingFounding, setClaimingFounding] = useState(false);
  const [currentSub, setCurrentSub] = useState(null);
  const [loading, setLoading] = useState(true);
  // Distinct from "no plans" — a failed fetch must not silently render as an
  // empty pricing page (doctrine's error-vs-empty rule). `plansLoaded` alone
  // does not carry this: it only says whether the request came back.
  const [loadError, setLoadError] = useState(false);
  const [processingPlan, setProcessingPlan] = useState(null);
  const [processingBundle, setProcessingBundle] = useState(null);
  const [currency] = useState(() => detectCurrency());

  useEffect(() => { loadData(); }, []);
  // Reaching the pricing page is the last stage before money; the gap between
  // this and `checkout_started` is the one the copy has to close.
  useEffect(() => { track(STAGES.PLANS_VIEWED); }, []);

  const loadData = async () => {
    setLoadError(false);
    try {
      const [plansRes, subRes] = await Promise.all([
        api.get('/subscription/plans'),
        api.get('/subscription/my-subscription'),
      ]);
      setPlans(plansRes.data.plans || {});
      setPlansLoaded(true);
      const liveBundles = plansRes.data.bundles;
      if (liveBundles && Object.keys(liveBundles).length) {
        setBundles(Object.values(liveBundles));
      }
      setLaunchOffer(plansRes.data.launchOffer || { active: false });
      setFounding(plansRes.data.founding || { open: false });
      setCurrentSub(subRes.data.subscription);
    } catch {
      setLoadError(true);
      toast.error('Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  const openCheckout = ({ order, description, onVerify, onSettle }) =>
    new Promise((resolve) => {
      const rzp = new window.Razorpay({
        key: razorpay.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'TricityMatch',
        description,
        order_id: order.id,
        handler: async (response) => {
          try {
            await onVerify(response);
            toast.success('Payment successful');
            await loadData();
          } catch {
            toast.error('Payment verification failed');
          } finally {
            onSettle();
            resolve();
          }
        },
        prefill: {
          name: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || undefined,
          email: user?.email || undefined,
          contact: user?.phone || user?.phoneNumber || undefined,
        },
        theme: { color: '#8B2346' },
        modal: { ondismiss: () => { onSettle(); resolve(); } },
      });
      rzp.on('payment.failed', () => {
        toast.error('Payment failed. Please try again.');
        onSettle();
        resolve();
      });
      rzp.open();
    });

  const handleSubscribe = async (planType) => {
    // Fires on intent, not on success — a checkout that starts and never
    // finishes is precisely what the abandoned-checkout mail chases, and the
    // count of them is what says whether the payment step itself is broken.
    track(STAGES.CHECKOUT_STARTED, { once: false });
    if (!ensurePaymentsAvailable()) return;
    if (processingPlan) return; // guard against double-submit / double order

    setProcessingPlan(planType);
    try {
      const res = await api.post('/subscription/create-order', { planType });
      await loadRazorpayScript();
      await openCheckout({
        order: res.data.order,
        description: `${planDisplayName(planType)} Subscription`,
        onVerify: (response) => api.post('/subscription/verify-payment', {
          razorpayOrderId:   response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
        }),
        onSettle: () => setProcessingPlan(null),
      });
    } catch (error) {
      toast.error(
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        error.message ||
        'Failed to create order'
      );
      setProcessingPlan(null);
    }
  };

  const handleBuyBundle = async (bundleId) => {
    if (!ensurePaymentsAvailable()) return;
    if (processingBundle) return;

    setProcessingBundle(bundleId);
    try {
      const res = await api.post('/subscription/unlock-bundle/create-order', { bundleId });
      await loadRazorpayScript();
      await openCheckout({
        order: res.data.order,
        description: 'Contact unlock top-up',
        onVerify: (response) => api.post('/subscription/unlock-bundle/verify-payment', {
          razorpayOrderId:   response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
        }),
        onSettle: () => setProcessingBundle(null),
      });
    } catch (error) {
      toast.error(
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        error.message ||
        'Failed to start purchase'
      );
      setProcessingBundle(null);
    }
  };

  const handleClaimFounding = async () => {
    if (claimingFounding) return;
    setClaimingFounding(true);
    try {
      const res = await api.post('/subscription/claim-founding');
      toast.success(res.data?.message || 'Founding membership activated');
      // Both have to move: the subscription drives this page, and
      // `canClaimFounding` on the user is what hides the button everywhere else.
      await Promise.all([loadData(), checkAuth()]);
    } catch (error) {
      toast.error(
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        'Could not claim the founding offer'
      );
    } finally {
      setClaimingFounding(false);
    }
  };

  // Friendly plan name display
  const planDisplayName = (type) => {
    const names = {
      basic_premium: 'Basic',
      premium_plus: 'Premium',
      elite: 'Elite',
      vip: 'VIP',
      nri: 'NRI Connect',
      // Granted, never sold — but it IS what an active founding member holds,
      // and the banner rendered the raw enum ("founding_premium") without it.
      founding_premium: 'Founding Member',
    };
    return names[type] || type;
  };

  if (loading) {
    // Matches the OverlapPricingPair shape (Free behind, Premium raised and
    // overlapping) — the common single-plan case today (see the comment on
    // `gridPlans.length === 2` below) — rather than a flat N-up grid that
    // would resolve into a visibly different layout on load.
    return (
      <div className="min-h-[100dvh] bg-neutral-50 dark:bg-surface-dark-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-12 flex flex-col items-center gap-3">
            <Skeleton className="h-10 w-72 rounded-xl" />
            <Skeleton className="h-4 w-96 max-w-full rounded" />
          </div>
          <div className="relative mx-auto max-w-sm sm:max-w-none sm:flex sm:justify-center sm:items-start pt-4 pb-6">
            <div className="relative z-0 flex flex-col rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-surface-dark-1 p-6 sm:w-72 sm:flex-shrink-0 sm:p-7 sm:pt-8 sm:mr-[-1.75rem] space-y-3">
              <Skeleton className="h-5 w-20 rounded-lg" />
              <Skeleton className="h-8 w-24 rounded-lg" />
              <Skeleton.Text lines={4} className="pt-2" />
              <Skeleton className="h-11 w-full rounded-xl mt-4" />
            </div>
            <div className="relative z-10 flex flex-col rounded-2xl bg-white dark:bg-surface-dark-3 shadow-card-hover p-6 sm:w-80 sm:flex-shrink-0 sm:p-7 sm:pt-8 -mt-6 mx-3 sm:mx-0 sm:-mt-4 sm:mb-[-1rem] space-y-3">
              <Skeleton className="h-6 w-28 rounded-lg" />
              <Skeleton className="h-10 w-32 rounded-lg" />
              <Skeleton.Text lines={5} className="pt-2" />
              <Skeleton className="h-11 w-full rounded-xl mt-4" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-[100dvh] bg-neutral-50 dark:bg-surface-dark-1 flex items-center justify-center px-4">
        <ErrorState onRetry={loadData} />
      </div>
    );
  }

  // Distinct from loadError: the request came back 200 but with an empty or
  // malformed `plans` object. Left unhandled, `gridPlans` below silently
  // collapses to a Free-only card (`key === 'free' || Boolean(plans[key])`
  // always keeps 'free') with no messaging — the page would just look like
  // the product only offers a free tier instead of saying pricing failed to
  // load.
  const plansMissing = plansLoaded && Object.keys(plans).length === 0;
  if (plansMissing) {
    return (
      <div className="min-h-[100dvh] bg-neutral-50 dark:bg-surface-dark-1 flex items-center justify-center px-4">
        <EmptyState
          icon={FiInfo}
          title="Pricing isn't available right now"
          description="We couldn't load our membership plans. Please try again in a moment."
          actionLabel="Refresh"
          onAction={loadData}
        />
      </div>
    );
  }

  const currentPlanType = currentSub?.status === 'active' ? currentSub?.planType : 'free';
  // Bundles apply only to an active FINITE plan (unlimited plans hide them).
  const showBundles = currentSub?.status === 'active'
    && currentSub?.contactUnlocksAllowed != null;

  // Build the grid list from the API — NRI excluded (own block). A tier the API
  // omitted is WITHDRAWN and must not render; the PLAN_CONFIG fallback is only
  // for the case where the request failed outright and we have nothing at all,
  // otherwise it would resurrect exactly the card the server just withdrew.
  const gridPlans = GRID_KEYS
    .filter((key) => (plansLoaded ? key === 'free' || Boolean(plans[key]) : true))
    .map((key) => [
      key,
      plans[key] || {
        name: PLAN_CONFIG[key].label,
        price: PLAN_CONFIG[key].price || 0,
        duration: PLAN_CONFIG[key].duration || null,
      },
    ]);

  // NRI Connect is a segment tier, not a rung on the ladder. Shown to everyone
  // it is just one more card each buyer has to read and rule out, which is the
  // cost every extra option carries. Members who declared NRI status see it;
  // so does anyone already holding it, or the page would hide their own plan.
  const showNri = Boolean(plans.nri) && (
    user?.Profile?.isNri === true || currentSub?.planType === 'nri'
  );

  // How many PAID cards the reader actually sees. With one plan on sale
  // "Choose Your Plan" asks a question the page does not pose — the decision is
  // whether to buy at all, not which to buy — so the header re-words itself
  // rather than shipping copy the layout contradicts.
  const paidCardCount = gridPlans.filter(([key]) => key !== 'free').length + (showNri ? 1 : 0);
  const singlePlan = paidCardCount === 1;

  return (
    <div className="min-h-[100dvh] bg-neutral-50 dark:bg-surface-dark-1">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Header. No eyebrow label (doctrine §2 ruling 2) — the heading
            carries the meaning on its own. */}
        <motion.div {...fadeRise} className="text-center mb-12">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
            {singlePlan ? 'Go Premium' : 'Choose Your Plan'}
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 text-lg max-w-lg mx-auto">
            Unlock premium features and find your perfect match faster.
          </p>
        </motion.div>

        {/* Launch offer (server-gated) */}
        <LaunchBanner offer={launchOffer} />
        <FoundingBand
          user={user}
          founding={founding}
          currentSub={currentSub}
          onClaim={handleClaimFounding}
          claiming={claimingFounding}
        />

        {/* Payments-unavailable notice */}
        {!razorpay.isConfigured && (
          <motion.div
            {...fadeRise}
            className="mb-8 flex items-center gap-3 px-5 py-3.5 bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 rounded-2xl"
          >
            <div className="w-8 h-8 rounded-full bg-white dark:bg-surface-dark-3 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center flex-shrink-0">
              <FiClock className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              Online payments are opening soon. To upgrade today, write to{' '}
              <a href="mailto:support@tricitymatch.com" className="font-semibold text-primary-600 dark:text-primary-400 underline underline-offset-2">support@tricitymatch.com</a>.
            </p>
          </motion.div>
        )}

        {/* Active subscription banner (paid plans only — free has no "sub") */}
        {currentSub?.status === 'active' && currentSub?.planType !== 'free' && (
          <motion.div
            {...fadeRise}
            className="mb-8 flex items-center gap-3 px-5 py-3.5 bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800/40 rounded-2xl"
          >
            <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
              <FiCheck className="w-4 h-4 text-white" />
            </div>
            <p className="text-sm text-primary-700 dark:text-primary-300 font-medium">
              You have an active <strong>{planDisplayName(currentSub.planType)}</strong> subscription
              {currentSub.endDate && (
                <span className="font-normal text-primary-700/70 dark:text-primary-300/70">
                  {' '}· valid until {new Date(currentSub.endDate).toLocaleDateString()}
                </span>
              )}
              {currentSub.contactUnlocksAllowed != null && (
                <span className="font-normal text-success/80">
                  {' '}· {`${Math.max(0, (currentSub.contactUnlocksAllowed || 0) - (currentSub.contactUnlocksUsed || 0))} of ${currentSub.contactUnlocksAllowed}`} unlocks remaining
                </span>
              )}
              {/* Unlimited plans have no `contactUnlocksAllowed` count to show —
                  but "unlimited" is capped in practice (anti-harvest rolling
                  24h ceiling), and that fact belongs right here, not omitted. */}
              {currentSub.contactUnlocksAllowed == null && plans[currentSub.planType]?.unlockDailyCap != null && (
                <span className="font-normal text-primary-700/70 dark:text-primary-300/70">
                  {' '}· unlimited unlocks, up to {plans[currentSub.planType].unlockDailyCap}/day
                </span>
              )}
            </p>
          </motion.div>
        )}

        {/* Plan grid — column count follows the number of live tiers. Exactly
            two cards (Free + the one plan on sale, the common case today) get
            the overlap-pair treatment; three or more fall back to the equal
            weight grid, because the overlap composition only reads correctly
            as a two-way choice. */}
        {gridPlans.length === 2 ? (
          <OverlapPricingPair
            freeEntry={gridPlans.find(([key]) => key === 'free') || gridPlans[0]}
            paidEntry={gridPlans.find(([key]) => key !== 'free') || gridPlans[1]}
            currentPlanType={currentPlanType}
            isCurrentPaid={currentSub?.status === 'active' && currentSub?.planType === (gridPlans.find(([key]) => key !== 'free') || gridPlans[1])[0]}
            isProcessing={processingPlan === (gridPlans.find(([key]) => key !== 'free') || gridPlans[1])[0]}
            freeChatForMutuals={freeChatForMutuals}
            onSubscribe={handleSubscribe}
          />
        ) : (
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${GRID_COLS[gridPlans.length] || 'lg:grid-cols-4'} gap-5 items-start`}>
            {/* PlanCard owns its own single fadeRise entrance (doctrine
                §4.3/§5) — no second motion wrapper stacking an unsynced
                entrance on top of it. The per-item stagger is threaded in as
                a delay on that same animation via `staggerIndex`. */}
            {gridPlans.map(([key, plan], idx) => (
              <PlanCard
                key={key}
                planKey={key}
                plan={plan}
                // The tier actually rendered below this one — not the one below
                // it in the enum, which may have been withdrawn.
                prevName={idx > 0 ? (gridPlans[idx - 1][1].name || PLAN_CONFIG[gridPlans[idx - 1][0]]?.label) : null}
                isPopular={Boolean(plan.popular)}
                isCurrent={currentSub?.planType === key && currentSub?.status === 'active'}
                currentPlanType={currentPlanType}
                isProcessing={processingPlan === key}
                freeChatForMutuals={freeChatForMutuals}
                onSubscribe={handleSubscribe}
                entranceDelay={staggerIndex(idx)}
              />
            ))}
          </div>
        )}

        {/* Contact-unlock top-ups (active finite plan only) */}
        {showBundles && (
          <BundleBlock bundles={bundles} processingBundle={processingBundle} onBuy={handleBuyBundle} />
        )}

        {/* NRI Connect band — segment tier, shown only where it applies */}
        {showNri && (
        <NriBlock
          plan={plans.nri}
          // NRI sits beside the ladder, not on top of it, so it chains off the
          // highest tier the member can actually see.
          topLadderName={gridPlans.length > 1 ? gridPlans[gridPlans.length - 1][1].name : null}
          currency={currency}
          isCurrent={currentSub?.planType === 'nri' && currentSub?.status === 'active'}
          currentPlanType={currentPlanType}
          isProcessing={processingPlan === 'nri'}
          onSubscribe={handleSubscribe}
        />
        )}

        {/* Long-scroll paywall: comparison → proof → FAQ → closing CTA */}
        <ComparisonSection plans={plans} planKeys={gridPlans.map(([key]) => key)} />
        <SuccessStrip />
        <FaqSection unlockDailyCap={Object.values(plans).find((p) => p.contactUnlocks === -1)?.unlockDailyCap ?? null} />

        <section className="mt-14 text-center">
          <h2 className="font-display text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">Your family is waiting to hear good news</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-5">Join the Tricity members already talking to their matches.</p>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-hero text-white rounded-full font-semibold hover:shadow-burgundy hover:scale-105 transition-[box-shadow,transform] duration-200"
          >
            <FaCrown className="w-4 h-4 text-gold-300" /> {singlePlan ? 'Go Premium' : 'Choose a plan'}
          </button>
        </section>

        <StickyCtaBar show={(currentPlanType || 'free') === 'free'} />

        {/* Footer note */}
        <motion.p {...fade} className="text-center text-xs text-neutral-400 mt-10">
          Secure payments via Razorpay · One-time payment, no auto-renewal · Full refund within 7 days, see our{' '}
          <Link to="/refund-policy" className="underline underline-offset-2 hover:text-neutral-600 dark:hover:text-neutral-300">Refund Policy</Link>
        </motion.p>
      </div>
    </div>
  );
};

export default Subscription;
