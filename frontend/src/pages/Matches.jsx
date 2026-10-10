import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiBookmark, FiHeart, FiUsers, FiLock, FiSend } from 'react-icons/fi';
import { sanitizeText } from '../utils/sanitize';
import { getImageUrl } from '../utils/cloudinary';
import { API_BASE_URL } from '../utils/api';
import { FaCrown } from 'react-icons/fa';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { keptLikeMessage } from '../utils/matchCopy';
import { ProfileCard } from '../components/cards';
import { useMatchCelebration } from '../context/MatchCelebrationContext';
import InviteLink from '../components/common/InviteLink';
import SectionHeader from '../components/common/SectionHeader';
import { Skeleton, EmptyState, ErrorState } from '../components/ui';
import RetryImage from '../components/ui/RetryImage';

// Each tab maps to a match endpoint + the response key it returns. Its label
// and empty-state copy live under `matches.tabs.<id>` and are read at render.
const TABS = [
  { id: 'shortlist', icon: FiBookmark, endpoint: '/match/shortlist', respKey: 'shortlisted' },
  { id: 'mutual', icon: FiUsers, endpoint: '/match/mutual', respKey: 'mutualMatches' },
  { id: 'sent', icon: FiSend, endpoint: '/match/sent', respKey: 'sent' },
  { id: 'likes', icon: FiHeart, endpoint: '/match/likes', respKey: 'likes', premium: true },
];

// Two shapes, alternated in the grid below — ProfileCard now renders either a
// ~224px photo hero or a ~76px photoless identity header (audit Part 5 #3),
// and a loading grid of uniformly tall placeholders followed by a real grid
// that's mostly the shorter shape is a visible layout shift on load (doctrine
// §9 Craft, §6 Loading: "skeletons that match the final layout's shape").
const CardSkeleton = ({ compact = false }) => (
  <div className="bg-white dark:bg-surface-dark-3 rounded-xl overflow-hidden shadow-card">
    {compact ? (
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3.5">
        <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
        <Skeleton className="w-11 h-11 rounded-full flex-shrink-0" />
      </div>
    ) : (
      <Skeleton className="h-56 w-full rounded-none" />
    )}
    <div className="p-5 space-y-3">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-1.5 w-full rounded-full" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-20" />
      </div>
    </div>
  </div>
);

export default function Matches() {
  const { t } = useTranslation();
  const { celebrate } = useMatchCelebration();
  // ?tab= lets other surfaces deep-link a specific list — notification taps in
  // particular. An unknown value falls back to Saved rather than rendering an
  // empty shell for a tab that doesn't exist.
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab');
  const [active, setActive] = useState(
    TABS.some((x) => x.id === requested) ? requested : 'shortlist'
  );
  const [state, setState] = useState('loading'); // loading | ready | empty | error | premium
  const [profiles, setProfiles] = useState([]);
  const [confirm, confirmDialog] = useConfirm();

  const tab = TABS.find((x) => x.id === active);

  const load = useCallback(async (tabId) => {
    const cfg = TABS.find((x) => x.id === tabId);
    setState('loading');
    setProfiles([]);
    try {
      const res = await api.get(cfg.endpoint);
      let list = res.data?.[cfg.respKey] || [];
      // Everyone on Saved is saved, so the card's bookmark starts filled and a
      // tap takes the profile back off the list instead of saving it again.
      if (tabId === 'shortlist') list = list.map((p) => ({ ...p, matchStatus: 'shortlist' }));
      // On the Sent tab every profile is one the member has already liked, so
      // the card's primary action reads "Interest Sent" (a toggle to withdraw)
      // instead of offering to express interest in them a second time.
      if (tabId === 'sent') list = list.map((p) => ({ ...p, matchStatus: 'like' }));
      // Likes You lists every like aimed at the member, including people they
      // already liked back. Those are matches: show Message, not Express Interest.
      if (tabId === 'likes') {
        list = list.map((p) => ({
          ...p,
          matchStatus: p.myAction === 'like' || p.myAction === 'shortlist' ? p.myAction : null,
          likedBack: p.myAction === 'like',
        }));
      }
      setProfiles(list);
      setState(list.length ? 'ready' : 'empty');
    } catch (err) {
      const code = err.response?.status;
      const apiCode = err.response?.data?.error?.code;
      if (cfg.premium && (code === 403 || apiCode === 'PREMIUM_REQUIRED')) {
        setState('premium');
      } else {
        setState('error');
      }
    }
  }, []);

  useEffect(() => { load(active); }, [active, load]);

  // A notification deep-link can change ?tab= while this page is already
  // mounted; the load effect keys off `active`, not the URL, so without this
  // sync the tab wouldn't follow the link (the deep-link promise above).
  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    if (TABS.some((x) => x.id === requestedTab) && requestedTab !== active) {
      setActive(requestedTab);
    }
  }, [searchParams, active]);

  // Match actions on the cards — optimistic, then reconcile.
  // `want` is the state the member asked for (true = like / save, false = take it
  // back, sent as 'undo'). Returns whether the server accepted it so the card
  // icon can revert on failure.
  const handleAction = async (userId, action, want = true) => {
    const target = profiles.find((p) => (p.userId || p.id) === userId);
      // Taking back a like on a mutual match ends the match and the chat for
      // both members; one stray tap on "Interest Sent" used to do that silently.
      if (!want && action === 'like' && (active === 'mutual' || target?.isMutual || target?.likedBack)) {
        const ok = await confirm({
          title: t('matches.endMatch.title', { name: target?.firstName || t('matches.endMatch.thisMember') }),
          body: t('matches.endMatch.body'),
          confirmLabel: t('matches.endMatch.confirm'),
          cancelLabel: t('matches.endMatch.cancel'),
        });
        if (!ok) return false;
      }
    try {
      const res = await api.post(`/match/${userId}`, { action: want ? action : 'undo' });
      // Saving someone you already sent an interest to keeps the interest.
      if (res.data?.keptLike) { toast(keptLikeMessage(res.data)); return false; }
      // A new match gets the celebration instead of a toast underneath it.
      if (want && action === 'like' && !res.data?.newMatch) toast.success(t('matches.interestExpressed'));
      if (!want) toast.success(action === 'like' ? t('matches.interestWithdrawn') : t('matches.removedFromShortlist'));
      if (res.data?.newMatch) celebrate(profiles.find((p) => (p.userId || p.id) === userId));
      // Taking a row back drops the card from the tab that lists exactly that row
      // (Saved = shortlist, Sent = like).
      const dropsHere = !want && ((active === 'shortlist' && action === 'shortlist') || (active === 'sent' && action === 'like'));
      if (dropsHere) {
        setProfiles((prev) => {
          const next = prev.filter((p) => (p.userId || p.id) !== userId);
          if (!next.length) setState('empty');
          return next;
        });
      }
      return true;
    } catch {
      toast.error(t('matches.actionError'));
      return false;
    }
  };

  return (
    <div className="min-h-[100dvh] bg-neutral-50 dark:bg-surface-dark-1 pb-24 md:pb-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SectionHeader
          as="h1"
          title={t('matches.title')}
          subtitle={t('matches.subtitle')}
        />

        {/* Tabs */}
        {/* overflow-x-auto + flex-none: 4 tabs (Saved/Mutual/Sent/Likes You)
            do not fit 343px of usable width at 375px, and `flex-1` cannot
            shrink a flex item below its own content's intrinsic width — the
            row was pushing the whole page 51px wider than the viewport.
            Scrolling inside this row contains it instead. */}
        {/* mask-image fades the right edge on mobile so the off-screen "Likes
            You" tab is discoverable; disabled from sm up where the row is w-fit. */}
        <div
          role="tablist"
          aria-label={t('matches.tabsAria')}
          className="flex gap-1 bg-white dark:bg-surface-dark-3 rounded-2xl shadow-card p-1.5 mb-6 mt-5 w-full sm:w-fit overflow-x-auto scrollbar-hide [mask-image:linear-gradient(to_right,#000_90%,transparent)] sm:[mask-image:none]"
        >
          {TABS.map((tb) => {
            const Icon = tb.icon;
            const isActive = active === tb.id;
            return (
              <button
                key={tb.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  setActive(tb.id);
                  // Keep the URL honest so a refresh or a shared link lands on
                  // the tab the member is actually looking at.
                  setSearchParams(tb.id === 'shortlist' ? {} : { tab: tb.id }, { replace: true });
                }}
                className={`flex-1 sm:flex-none whitespace-nowrap flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-sm font-bold transition-colors duration-[160ms] ${
                  isActive
                    ? 'bg-primary-500 text-white shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                }`}
              >
                {/* Text-only on a phone: with icons the fourth tab ("Likes You",
                    the premium one) was pushed off-screen behind a fade. */}
                <Icon className="hidden sm:block w-4 h-4" aria-hidden="true" />
                {t(`matches.tabs.${tb.id}.label`)}
                {tb.premium && <FaCrown className="w-3 h-3 text-gold-400" />}
              </button>
            );
          })}
        </div>

        {/* ── Loading ─────────────────────────────────────────────── */}
        {state === 'loading' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {[0, 1, 2, 3, 4, 5].map((i) => <CardSkeleton key={i} compact={i % 2 === 1} />)}
          </div>
        )}

        {/* ── Error ───────────────────────────────────────────────── */}
        {state === 'error' && (
          <ErrorState
            title={t('matches.errorTitle')}
            description={t('matches.errorBody')}
            onRetry={() => load(active)}
            retryLabel={t('common.retry')}
            className="py-20"
          />
        )}

        {/* ── Premium gate (Likes You) ────────────────────────────── */}
        {state === 'premium' && (
          <div className="flex flex-col items-center justify-center text-center py-20">
            <div className="w-14 h-14 rounded-2xl bg-gold-50 dark:bg-gold-900/20 border border-gold-200 dark:border-gold-800 flex items-center justify-center mb-4">
              <FiLock className="w-7 h-7 text-gold-500" />
            </div>
            <h3 className="text-lg font-bold text-neutral-800 dark:text-neutral-100 mb-1">{t('matches.premiumTitle')}</h3>
            <p className="text-sm text-neutral-500 max-w-sm mb-5">
              {t('matches.premiumBody')}
            </p>
            <Link
              to="/subscription"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold text-neutral-900 rounded-xl text-sm font-bold hover:bg-gold-400 shadow-gold"
            >
              <FaCrown className="w-4 h-4" /> {t('matches.upgradeToPremium')}
            </Link>
          </div>
        )}

        {/* ── Empty ───────────────────────────────────────────────── */}
        {/* Supply-aware second line (Phase S, E3): every one of these tabs is
            empty for the SAME underlying reason early on — not enough members
            yet. Naming it (and offering the invite) beats a dead end that
            implies the member did something wrong. */}
        {state === 'empty' && (
          <div>
            <EmptyState
              icon={tab?.icon}
              title={tab ? t(`matches.tabs.${tab.id}.title`) : undefined}
              description={tab ? t(`matches.tabs.${tab.id}.line`) : undefined}
              actionLabel={t('matches.discoverProfiles')}
              onAction={() => navigate('/search')}
              className="py-20"
            />
            <p className="text-sm text-neutral-500 max-w-sm mx-auto text-center -mt-4">{tab ? t(`matches.tabs.${tab.id}.supply`) : null}</p>
            <div className="flex justify-center mt-4 pb-2">
              <InviteLink variant="inline" />
            </div>
          </div>
        )}

        {/* ── List ────────────────────────────────────────────────── */}
        {state === 'ready' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {profiles.map((profile, i) => {
              const pid = profile.userId || profile.id;
              if (!pid) return null;
              return (
                <div key={`match-${pid}`} className="flex flex-col h-full">
                  {/* D3/DS5: a like-with-note leads with the quoted note +
                      the liked-item snapshot above the standard card.
                      This wrapper (not ProfileCard) is the actual grid
                      item, so it needs `h-full` to pick up the CSS Grid
                      row-stretch, and the card below needs `flex-1` so it,
                      not the note, absorbs that extra height — otherwise a
                      note on one card and not its neighbour throws the two
                      button rows out of alignment (audit Part 5 #10). */}
                  {(profile.note || profile.likedItem) && (
                    <div className="mb-2 px-4 py-3 rounded-2xl bg-primary-50/70 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 flex items-start gap-3">
                      {profile.likedItem?.type === 'photo' && profile.likedItem.photoUrl && (
                        <RetryImage
                          src={getImageUrl(profile.likedItem.photoUrl, API_BASE_URL, 'thumbnail')}
                          alt=""
                          className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      )}
                      <div className="min-w-0">
                        {profile.likedItem && (
                          <p className="text-xs font-bold text-primary-600 dark:text-primary-300">
                            {active === 'sent'
                              ? t(profile.likedItem.type === 'prompt' ? 'matches.likedAnswerYou' : 'matches.likedPhotoYou')
                              : t(profile.likedItem.type === 'prompt' ? 'matches.likedAnswer' : 'matches.likedPhoto')}
                          </p>
                        )}
                        {profile.likedItem?.type === 'prompt' && profile.likedItem.promptText && (
                          <p className="text-xs text-neutral-500 line-clamp-1">“{sanitizeText(profile.likedItem.promptText)}”</p>
                        )}
                        {profile.note && (
                          <p className="text-sm text-neutral-700 dark:text-neutral-200 line-clamp-2">“{sanitizeText(profile.note)}”</p>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="flex-1 min-h-0">
                    <ProfileCard
                      profile={profile}
                      userId={pid}
                      index={i}
                      primaryCta={active === 'mutual' || profile.likedBack ? 'message' : 'interest'}
                      interestLabel={active === 'likes' ? t('matches.likeBack') : undefined}
                      onLike={(want) => handleAction(pid, 'like', want)}
                      onShortlist={(want) => handleAction(pid, 'shortlist', want)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {confirmDialog}
    </div>
  );
}
