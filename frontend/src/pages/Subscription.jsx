import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { FiCheck, FiArrowRight, FiZap, FiShield, FiClock, FiGlobe, FiPlusCircle } from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import { razorpay } from '../config';
import { loadRazorpayScript, ensurePaymentsAvailable } from '../utils/razorpayCheckout';
import { useAuth } from '../context/AuthContext';
import { detectCurrency, formatLocalPrice } from '../utils/currency';
import { planFeatures } from '../utils/planFeatures';

// ─── Plan card config ─────────────────────────
// accent: 'primary' (burgundy) | 'gold' (premium/VIP only) | 'neutral'
const PLAN_CONFIG = {
  free:           { label: 'Free',    accent: 'neutral', icon: null,     cta: 'Free Forever' },
  basic_premium:  { label: 'Basic',   accent: 'primary', icon: FiZap,    cta: 'Get Basic',   duration: '30 days',  price: 1299 },
  premium_plus:   { label: 'Premium', accent: 'primary', icon: FaCrown,  cta: 'Get Premium', duration: '90 days',  price: 2499 },
  elite:          { label: 'Elite',   accent: 'gold',    icon: FiShield, cta: 'Get Elite',   duration: '6 months', price: 3999 },
  vip:            { label: 'VIP',     accent: 'gold',    icon: FaCrown,  cta: 'Get VIP',      duration: '12 months', price: 5999 },
  nri:            { label: 'NRI Connect', accent: 'gold', icon: FiGlobe, cta: 'Get NRI Connect', duration: '6 months', price: 9999 },
};

// The five tiers shown in the main comparison grid (NRI gets its own block).
const GRID_KEYS = ['free', 'basic_premium', 'premium_plus', 'elite', 'vip'];

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
const COMPARE_ROWS = [
  { label: 'Contact unlocks', values: ['0', '—', '—', '—', 'Unlimited'] },
  { label: 'Chat with matches', values: [false, true, true, true, true] },
  { label: 'See who likes you', values: [false, true, true, true, true] },
  { label: 'Reactions, voice notes & quote replies', values: [false, true, true, true, true] },
  { label: 'Advanced filters', values: [false, true, true, true, true] },
  { label: 'Voice & video calls', values: [false, false, true, true, true] },
  { label: 'Profile boost', values: [false, false, false, true, true] },
  { label: 'Relationship manager', values: [false, false, false, false, true] },
];
const COMPARE_COLS = ['Free', 'Basic', 'Plus', 'Elite', 'VIP'];

const CompareCell = ({ v }) => (
  typeof v === 'boolean'
    ? (v ? <FiCheck className="w-4 h-4 text-success mx-auto" aria-label="Included" /> : <span className="text-neutral-300" aria-label="Not included">—</span>)
    : <span className="text-sm font-medium text-neutral-700">{v}</span>
);

const ComparisonSection = ({ plans = {} }) => {
  const [openCol, setOpenCol] = useState(4);

  // Column order mirrors COMPARE_COLS: Free, Basic, Plus, Elite, VIP.
  const unlockCell = (key) => {
    const v = plans?.[key]?.contactUnlocks;
    if (v === -1) return 'Unlimited';
    if (typeof v === 'number') return String(v);
    return '—';
  };
  const rows = COMPARE_ROWS.map((row) => (
    row.label === 'Contact unlocks'
      ? { ...row, values: ['0', unlockCell('basic_premium'), unlockCell('premium_plus'), unlockCell('elite'), unlockCell('vip')] }
      : row
  ));

  return (
    <section className="mt-14" aria-labelledby="compare-heading">
      <h2 id="compare-heading" className="font-display text-2xl font-bold text-neutral-900 text-center mb-6">Compare plans</h2>
      {/* Table ≥ sm */}
      <div className="hidden sm:block overflow-x-auto rounded-2xl border border-neutral-100 shadow-card bg-white">
        <table className="w-full text-center">
          <thead>
            <tr className="border-b border-neutral-100">
              <th className="py-3 px-4 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wide">Feature</th>
              {COMPARE_COLS.map((c) => (
                <th key={c} className="py-3 px-3 text-xs font-bold text-neutral-700">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-neutral-50 last:border-0">
                <td className="py-3 px-4 text-left text-sm text-neutral-600">{row.label}</td>
                {row.values.map((v, i) => <td key={i} className="py-3 px-3"><CompareCell v={v} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Accordion < sm */}
      <div className="sm:hidden space-y-2">
        {COMPARE_COLS.map((c, ci) => (
          <div key={c} className="rounded-2xl border border-neutral-100 bg-white overflow-hidden">
            <button
              onClick={() => setOpenCol(openCol === ci ? -1 : ci)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-neutral-800"
              aria-expanded={openCol === ci}
            >
              {c}
              <span className="text-neutral-400">{openCol === ci ? '−' : '+'}</span>
            </button>
            {openCol === ci && (
              <ul className="px-4 pb-3 space-y-1.5">
                {rows.map((row) => (
                  <li key={row.label} className="flex items-center justify-between text-sm">
                    <span className="text-neutral-600">{row.label}</span>
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
      <h2 id="stories-heading" className="font-display text-2xl font-bold text-neutral-900 text-center mb-6">Matches that became marriages</h2>
      <div className="grid sm:grid-cols-3 gap-4">
        {stories.map((st) => (
          <figure key={st.id} className="rounded-2xl border border-neutral-100 bg-white shadow-card p-5">
            <blockquote className="text-sm text-neutral-600 leading-relaxed line-clamp-4">“{st.story || st.content || ''}”</blockquote>
            <figcaption className="mt-3 text-sm font-semibold text-primary-700">{st.coupleNames || st.title || 'A TricityMatch couple'}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
};

const FAQS = [
  { q: 'Can I upgrade later?', a: 'Yes — you can move up to a higher plan any time while your current plan is active. The new plan starts fresh from the day you upgrade.' },
  { q: 'Is my payment secure?', a: 'All payments run through Razorpay over SSL. We never see or store your card details.' },
  { q: 'What are contact unlocks?', a: 'Each unlock reveals a member\u2019s phone number so your families can talk directly. VIP has no limit.' },
  { q: 'Do unused days carry over?', a: 'Upgrading starts a full fresh term on the new plan; remaining days on the old plan are not added on top.' },
  { q: 'Can my parents manage this account?', a: 'Yes — the Guardian feature lets a family member view matches and shortlists for you.' },
];

const FaqSection = () => {
  const [open, setOpen] = useState(0);
  return (
    <section className="mt-14 max-w-2xl mx-auto" aria-labelledby="faq-heading">
      <h2 id="faq-heading" className="font-display text-2xl font-bold text-neutral-900 text-center mb-6">Common questions</h2>
      <div className="space-y-2">
        {FAQS.map((f, i) => (
          <div key={f.q} className="rounded-2xl border border-neutral-100 bg-white overflow-hidden">
            <button
              onClick={() => setOpen(open === i ? -1 : i)}
              className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-semibold text-neutral-800"
              aria-expanded={open === i}
            >
              {f.q}
              <span className="text-neutral-400 ml-3 flex-shrink-0">{open === i ? '−' : '+'}</span>
            </button>
            {open === i && <p className="px-5 pb-4 text-sm text-neutral-500 leading-relaxed">{f.a}</p>}
          </div>
        ))}
      </div>
    </section>
  );
};

// DS11: sticky compact CTA bar on mobile after the first fold (free members).
const StickyCtaBar = ({ show }) => {
  const [pastFold, setPastFold] = useState(false);
  useEffect(() => {
    const onScroll = () => setPastFold(window.scrollY > 640);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
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

// ─── Single plan card ─────────────────────────
const PlanCard = ({ planKey, plan, isPopular, isCurrent, currentPlanType, isProcessing, freeChatForMutuals, onSubscribe }) => {
  const cfg = PLAN_CONFIG[planKey] || PLAN_CONFIG.free;
  const Icon = cfg.icon;
  const features = planFeatures(planKey, freeChatForMutuals, plan);
  const free = planKey === 'free';
  const gold = cfg.accent === 'gold';
  const displayPrice = plan.price || cfg.price || 0;
  const mrp = plan.mrp || null;
  const perMonth = plan.perMonth || null;
  const discountPct = mrp && mrp > displayPrice ? Math.round(((mrp - displayPrice) / mrp) * 100) : 0;

  // On a paid plan, only higher tiers are purchasable (as upgrades).
  const currentRank = TIER_RANK[currentPlanType] ?? 0;
  const thisRank = TIER_RANK[planKey] ?? 0;
  const onPaidPlan = currentRank > 0;
  const isUpgrade = onPaidPlan && thisRank > currentRank;
  const isIncluded = onPaidPlan && !isCurrent && !free && thisRank < currentRank;
  const disabled = isCurrent || free || isIncluded || isProcessing;

  const badge = plan.badge || (isPopular ? 'Most Popular' : null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={!free && !isCurrent ? { y: -6 } : {}}
      transition={{ duration: 0.35 }}
      className={`relative flex flex-col bg-white dark:bg-[#1a1f2e] rounded-2xl border transition-all duration-200 overflow-hidden ${
        isPopular
          ? 'border-primary-300 dark:border-primary-700/50 shadow-burgundy-lg ring-1 ring-primary-200 dark:ring-primary-800/40 scale-[1.03]'
          : gold
          ? 'border-gold-300 dark:border-gold-700/50 shadow-gold ring-1 ring-gold-200 dark:ring-gold-800/40'
          : 'border-neutral-200 dark:border-neutral-800 shadow-card'
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
              gold ? 'bg-gold-50 text-gold'
              : planKey === 'premium_plus' ? 'bg-primary-100 text-primary-600'
              : 'bg-primary-50 text-primary-500'
            }`}>
              <Icon className="w-4 h-4" />
            </div>
          )}
          <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">{plan.name || cfg.label}</h3>
          {isCurrent && (
            <span className="ml-auto px-2 py-0.5 bg-success-50 border border-success-100 text-success text-[10px] font-bold rounded-full uppercase tracking-wide">
              Active
            </span>
          )}
        </div>

        {/* Price + MRP anchor */}
        <div className="flex items-baseline gap-1.5 mb-1 flex-wrap">
          <span className={`text-4xl font-bold ${
            gold ? 'text-gold-600'
            : planKey === 'premium_plus' || planKey === 'basic_premium' ? 'text-primary-500'
            : 'text-neutral-700'
          }`}>
            {displayPrice > 0 ? `₹${displayPrice.toLocaleString('en-IN')}` : 'Free'}
          </span>
          {displayPrice > 0 && (
            <span className="text-sm text-neutral-500">/{plan.duration || cfg.duration}</span>
          )}
        </div>
        {displayPrice > 0 && (mrp || perMonth) && (
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {mrp && mrp > displayPrice && (
              <span className="text-sm text-neutral-400 line-through">₹{mrp.toLocaleString('en-IN')}</span>
            )}
            {discountPct > 0 && (
              <span className="text-[11px] font-bold text-success bg-success-50 border border-success-100 px-1.5 py-0.5 rounded">
                {plan.isLaunchPrice ? `Launch price · ${discountPct}% off` : `Flat ${discountPct}% off`}
              </span>
            )}
            {perMonth && (
              <span className="text-xs text-neutral-400">≈ ₹{perMonth.toLocaleString('en-IN')}/month</span>
            )}
            {plan.durationDays > 0 && displayPrice > 0 && (
              <span className="text-xs text-neutral-400">· ₹{Math.max(1, Math.round(displayPrice / plan.durationDays))}/day</span>
            )}
          </div>
        )}
        {displayPrice > 0 && plan.contactUnlocks != null && (
          <p className="text-xs text-primary-500 font-medium mt-1">
            {plan.contactUnlocks === -1 ? '∞ Unlimited' : plan.contactUnlocks} contact unlocks
          </p>
        )}
      </div>

      {/* Feature list */}
      <div className="flex-1 px-6 pb-6">
        <ul className="space-y-2.5">
          {features.map((f, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                gold ? 'bg-gold-100 text-gold-700' :
                planKey === 'premium_plus' ? 'bg-primary-100 text-primary-600' :
                planKey === 'basic_premium' ? 'bg-primary-50 text-primary-500' :
                'bg-neutral-100 text-neutral-500'
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
          className={`w-full py-3 text-sm font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:cursor-not-allowed ${
            isCurrent || free || isIncluded
              ? 'bg-neutral-100 text-neutral-500 cursor-default'
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
            ? 'Free Forever'
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

// ─── NRI Connect block (own styled band, shown to everyone) ────────────
const NriBlock = ({ plan, currency, isCurrent, currentPlanType, isProcessing, onSubscribe }) => {
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mt-8 rounded-2xl border border-gold-300 dark:border-gold-700/50 bg-gradient-to-br from-white to-gold-50/40 dark:from-[#1c2130] dark:to-[#221f16] shadow-gold ring-1 ring-gold-200 dark:ring-gold-800/40 overflow-hidden"
    >
      <div className="flex flex-col lg:flex-row lg:items-center gap-6 p-6 lg:p-8">
        <div className="flex-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-gold-100 dark:bg-gold-900/30 border border-gold-200 dark:border-gold-700/50 rounded-full mb-3">
            <FiGlobe className="w-3.5 h-3.5 text-gold-700 dark:text-gold-400" />
            <span className="text-[11px] font-bold text-gold-700 dark:text-gold-400 uppercase tracking-wide">For NRIs abroad</span>
          </div>
          <h3 className="font-display text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-1.5">NRI Connect</h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-300 max-w-md mb-3">
            Full VIP access built for members abroad — timezone-aware matching, priority support,
            and prices shown in your own currency.
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
            {planFeatures('nri', false, plan).map((f, i) => (
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
            className={`mt-4 w-full py-3 text-sm font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:cursor-not-allowed ${
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
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="mt-8 rounded-2xl border border-primary-200 bg-primary-50/50 p-6 lg:p-8"
  >
    <div className="flex items-center gap-2.5 mb-1.5">
      <FiPlusCircle className="w-5 h-5 text-primary-600" />
      <h3 className="text-lg font-bold text-neutral-900">Need more contact unlocks?</h3>
    </div>
    <p className="text-sm text-neutral-600 mb-5 max-w-xl">
      Top up your current plan anytime. Unlocks add to your active plan and stay valid until it expires.
    </p>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {bundles.map((b) => {
        const perUnlock = Math.round(b.price / b.unlocks);
        const busy = processingBundle === b.bundleId;
        return (
          <div key={b.bundleId} className="flex flex-col bg-white rounded-xl border border-neutral-200 p-5 shadow-card">
            <p className="text-2xl font-bold text-neutral-900">{b.unlocks} <span className="text-sm font-medium text-neutral-500">unlocks</span></p>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-lg font-semibold text-primary-600">₹{b.price.toLocaleString('en-IN')}</p>
              {b.mrp > b.price && (
                <span className="text-xs text-neutral-400 line-through">₹{b.mrp.toLocaleString('en-IN')}</span>
              )}
            </div>
            <p className="text-xs text-neutral-400 mb-4">₹{perUnlock} per unlock</p>
            <button
              onClick={() => !busy && onBuy(b.bundleId)}
              disabled={busy}
              aria-busy={busy || undefined}
              className="mt-auto w-full min-h-[44px] py-2.5 text-sm font-semibold rounded-lg bg-primary-500 text-white hover:bg-primary-600 shadow-burgundy transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
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
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8 rounded-2xl border border-gold-200 bg-gold-50 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3"
    >
      <div className="w-9 h-9 rounded-full bg-gold flex items-center justify-center flex-shrink-0">
        <FaCrown className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-bold text-gold-800">
          {offer.headline || 'Launch offer'}
          {daysLeft !== null && (
            <span className="ml-2 font-semibold text-gold-700">
              · {daysLeft === 0 ? 'ends today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
            </span>
          )}
        </p>
        {offer.subline && <p className="text-sm text-gold-700/80 mt-0.5">{offer.subline}</p>}
      </div>
      {offer.endsAt && (
        <p className="text-xs text-gold-700/70 sm:text-right">
          Prices return to normal on {new Date(offer.endsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      )}
    </motion.div>
  );
};

// ─────────────────────────────────────────────
const Subscription = () => {
  const { user } = useAuth();
  // Server-owned flag (see backend withDerivedUserFields). Absent ⇒ false, so
  // an older/failed /auth/me payload shows the paid-chat copy — the
  // conservative direction: it under-promises rather than advertising a free
  // feature the server would refuse.
  const freeChatForMutuals = Boolean(user?.features?.freeChatForMutuals);
  const [plans, setPlans] = useState({});
  const [bundles, setBundles] = useState(BUNDLES_FALLBACK);
  // Launch-offer state is server-owned and defaults to inactive, so a failed
  // load shows regular pricing with no discount claim rather than promising an
  // offer that checkout would not honour.
  const [launchOffer, setLaunchOffer] = useState({ active: false });
  const [currentSub, setCurrentSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processingPlan, setProcessingPlan] = useState(null);
  const [processingBundle, setProcessingBundle] = useState(null);
  const [currency] = useState(() => detectCurrency());

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [plansRes, subRes] = await Promise.all([
        api.get('/subscription/plans'),
        api.get('/subscription/my-subscription'),
      ]);
      setPlans(plansRes.data.plans || {});
      const liveBundles = plansRes.data.bundles;
      if (liveBundles && Object.keys(liveBundles).length) {
        setBundles(Object.values(liveBundles));
      }
      setLaunchOffer(plansRes.data.launchOffer || { active: false });
      setCurrentSub(subRes.data.subscription);
    } catch {
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
            toast.success('Payment successful!');
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
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-[#0f1117]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-12 flex flex-col items-center gap-3">
            <div className="h-7 w-40 bg-neutral-200 dark:bg-neutral-800 rounded-full animate-pulse" />
            <div className="h-10 w-72 bg-neutral-200 dark:bg-neutral-800 rounded-xl animate-pulse" />
            <div className="h-4 w-96 max-w-full bg-neutral-100 dark:bg-neutral-800/60 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 items-start">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white dark:bg-[#1a1f2e] rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-card p-6 space-y-4 animate-pulse">
                <div className="h-6 w-28 bg-neutral-200 dark:bg-neutral-800 rounded-lg" />
                <div className="h-10 w-32 bg-neutral-200 dark:bg-neutral-800 rounded-lg" />
                <div className="space-y-2.5 pt-2">
                  {[0, 1, 2, 3, 4].map((j) => (
                    <div key={j} className="h-3.5 w-full bg-neutral-100 dark:bg-neutral-800/60 rounded" />
                  ))}
                </div>
                <div className="h-11 w-full bg-neutral-200 dark:bg-neutral-800 rounded-xl mt-4" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const currentPlanType = currentSub?.status === 'active' ? currentSub?.planType : 'free';
  // Bundles apply only to an active FINITE plan (unlimited plans hide them).
  const showBundles = currentSub?.status === 'active'
    && currentSub?.contactUnlocksAllowed != null;

  // Build the grid list from the API (fallback to config) — NRI excluded (own block).
  const gridPlans = GRID_KEYS.map((key) => [
    key,
    plans[key] || {
      name: PLAN_CONFIG[key].label,
      price: PLAN_CONFIG[key].price || 0,
      duration: PLAN_CONFIG[key].duration || null,
    },
  ]);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0f1117]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gold-50 border border-gold-200 rounded-full mb-5">
            <FaCrown className="w-3.5 h-3.5 text-gold" />
            <span className="text-xs font-semibold text-gold-700 uppercase tracking-wide">Membership Plans</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
            Choose Your Plan
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 text-lg max-w-lg mx-auto">
            Unlock premium features and find your perfect match faster.
          </p>
        </motion.div>

        {/* Launch offer (server-gated) */}
        <LaunchBanner offer={launchOffer} />

        {/* Payments-unavailable notice */}
        {!razorpay.isConfigured && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 flex items-center gap-3 px-5 py-3.5 bg-neutral-100 border border-neutral-200 rounded-2xl"
          >
            <div className="w-8 h-8 rounded-full bg-white border border-neutral-200 flex items-center justify-center flex-shrink-0">
              <FiClock className="w-4 h-4 text-neutral-500" />
            </div>
            <p className="text-sm text-neutral-600">
              Online payments are opening soon. To upgrade today, write to{' '}
              <a href="mailto:support@tricitymatch.com" className="font-semibold text-primary-600 underline underline-offset-2">support@tricitymatch.com</a>.
            </p>
          </motion.div>
        )}

        {/* Active subscription banner (paid plans only — free has no "sub") */}
        {currentSub?.status === 'active' && currentSub?.planType !== 'free' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 flex items-center gap-3 px-5 py-3.5 bg-primary-50 border border-primary-100 rounded-2xl"
          >
            <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
              <FiCheck className="w-4 h-4 text-white" />
            </div>
            <p className="text-sm text-primary-700 font-medium">
              You have an active <strong>{planDisplayName(currentSub.planType)}</strong> subscription
              {currentSub.endDate && (
                <span className="font-normal text-primary-700/70">
                  {' '}· valid until {new Date(currentSub.endDate).toLocaleDateString()}
                </span>
              )}
              {currentSub.contactUnlocksAllowed != null && (
                <span className="font-normal text-success/80">
                  {' '}· {`${Math.max(0, (currentSub.contactUnlocksAllowed || 0) - (currentSub.contactUnlocksUsed || 0))} of ${currentSub.contactUnlocksAllowed}`} unlocks remaining
                </span>
              )}
            </p>
          </motion.div>
        )}

        {/* Plan grid — 5 columns on desktop (NRI has its own block below) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 items-start">
          {gridPlans.map(([key, plan], idx) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
            >
              <PlanCard
                planKey={key}
                plan={plan}
                isPopular={key === 'premium_plus' || plan.popular}
                isCurrent={currentSub?.planType === key && currentSub?.status === 'active'}
                currentPlanType={currentPlanType}
                isProcessing={processingPlan === key}
                freeChatForMutuals={freeChatForMutuals}
                onSubscribe={handleSubscribe}
              />
            </motion.div>
          ))}
        </div>

        {/* Contact-unlock top-ups (active finite plan only) */}
        {showBundles && (
          <BundleBlock bundles={bundles} processingBundle={processingBundle} onBuy={handleBuyBundle} />
        )}

        {/* NRI Connect band — shown to everyone */}
        <NriBlock
          plan={plans.nri}
          currency={currency}
          isCurrent={currentSub?.planType === 'nri' && currentSub?.status === 'active'}
          currentPlanType={currentPlanType}
          isProcessing={processingPlan === 'nri'}
          onSubscribe={handleSubscribe}
        />

        {/* Long-scroll paywall: comparison → proof → FAQ → closing CTA */}
        <ComparisonSection plans={plans} />
        <SuccessStrip />
        <FaqSection />

        <section className="mt-14 text-center">
          <h2 className="font-display text-2xl font-bold text-neutral-900 mb-2">Your family is waiting to hear good news</h2>
          <p className="text-sm text-neutral-500 mb-5">Join the Tricity members already talking to their matches.</p>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-hero text-white rounded-full font-semibold hover:shadow-burgundy hover:scale-105 transition-all"
          >
            <FaCrown className="w-4 h-4 text-gold-300" /> Choose a plan
          </button>
        </section>

        <StickyCtaBar show={(currentPlanType || 'free') === 'free'} />

        {/* Footer note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-xs text-neutral-400 mt-10"
        >
          All plans include SSL-secured payments via Razorpay · 100% privacy guaranteed · Cancel anytime
        </motion.p>
      </div>
    </div>
  );
};

export default Subscription;
