import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { FiUsers, FiUserPlus, FiTrash2, FiEye, FiHeart, FiStar } from 'react-icons/fi';
import { EmptyState, ErrorState, Skeleton } from '../components/ui';

export default function Guardian() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('guardians');
  const [guardians, setGuardians] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const emailInputRef = useRef(null);
  const [loading, setLoading] = useState(true);
  // A failed fetch is never rendered as "no guardians yet" — that hides a
  // server problem behind a claim about the member's own data.
  const [loadError, setLoadError] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(null); // linkId pending confirmation

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [g, c] = await Promise.all([
        api.get('/guardian/my-guardians'),
        api.get('/guardian/my-candidates'),
      ]);
      setGuardians(g.data.guardians || []);
      setCandidates(c.data.candidates || []);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const invite = async (e) => {
    e.preventDefault();
    if (!email) return;
    setInviting(true);
    try {
      const res = await api.post('/guardian/invite', { email });
      toast.success(res.data.message || 'Invite sent');
      setEmail('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invite failed');
    } finally {
      setInviting(false);
    }
  };

  const revoke = async (linkId) => {
    try {
      await api.delete(`/guardian/${linkId}`);
      toast.success('Access revoked');
      setGuardians((prev) => prev.filter((g) => g.linkId !== linkId));
    } catch {
      toast.error('Could not revoke');
    } finally {
      setConfirmRevoke(null);
    }
  };

  const rowSkeleton = (
    <div className="space-y-3">
      {[0, 1].map((i) => (
        <div key={i} className="flex items-center justify-between bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-1">
        <FiUsers className="w-7 h-7 text-primary-600" />
        <h1 className="text-2xl font-semibold text-neutral-800 dark:text-neutral-100">{t('guardian.title')}</h1>
      </div>
      <p className="text-neutral-500 dark:text-neutral-400 mb-6">{t('guardian.subtitle')}</p>

      <div className="flex gap-2 mb-6">
        <TabBtn active={tab === 'guardians'} onClick={() => setTab('guardians')}>{t('guardian.myGuardians')}</TabBtn>
        <TabBtn active={tab === 'candidates'} onClick={() => setTab('candidates')}>{t('guardian.myCandidates')}</TabBtn>
      </div>

      {tab === 'guardians' && (
        <>
          <form onSubmit={invite} className="flex gap-2 items-end mb-6">
            <div className="flex-1">
              <label htmlFor="guardian-invite-email" className="block text-sm font-medium text-neutral-600 dark:text-neutral-300 mb-1">
                {t('guardian.inviteByEmail')}
              </label>
              <input
                id="guardian-invite-email"
                ref={emailInputRef}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('guardian.inviteByEmail')}
                className="w-full px-4 py-3 text-base rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-[border-color,box-shadow] duration-[160ms]"
              />
            </div>
            <button
              type="submit"
              disabled={inviting}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60 font-medium transition-colors duration-[160ms]"
            >
              <FiUserPlus className="w-4 h-4" /> {t('guardian.invite')}
            </button>
          </form>

          {loading ? (
            rowSkeleton
          ) : loadError ? (
            <ErrorState
              title="Couldn't load your guardians"
              description="The connection dropped before this finished loading. Try again."
              onRetry={load}
            />
          ) : guardians.length === 0 ? (
            <EmptyState
              icon={FiUsers}
              title={t('guardian.noGuardians')}
              actionLabel={t('guardian.inviteByEmail')}
              onAction={() => emailInputRef.current?.focus()}
            />
          ) : (
            <ul className="space-y-3">
              {guardians.map((g) => (
                <li key={g.linkId} className="flex items-center justify-between bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-neutral-800 dark:text-neutral-100 font-medium">{g.email}</p>
                    <span className={`text-xs capitalize ${g.status === 'active' ? 'text-success' : 'text-warning'}`}>{g.status}</span>
                  </div>
                  {confirmRevoke === g.linkId ? (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-neutral-500 dark:text-neutral-400">Revoke access?</span>
                      <button onClick={() => revoke(g.linkId)} className="inline-flex items-center justify-center min-h-[44px] px-2.5 py-1 rounded-md bg-destructive text-white font-medium hover:bg-destructive/90 transition-colors duration-[160ms]">Yes</button>
                      <button onClick={() => setConfirmRevoke(null)} className="inline-flex items-center justify-center min-h-[44px] px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors duration-[160ms]">No</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmRevoke(g.linkId)} className="inline-flex items-center gap-1.5 text-destructive hover:opacity-80 text-sm">
                      <FiTrash2 className="w-4 h-4" /> {t('guardian.revoke')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === 'candidates' && (
        loading ? (
          rowSkeleton
        ) : loadError ? (
          <ErrorState
            title="Couldn't load your candidates"
            description="The connection dropped before this finished loading. Try again."
            onRetry={load}
          />
        ) : candidates.length === 0 ? (
          <EmptyState icon={FiHeart} title={t('guardian.noCandidates')} />
        ) : (
          <ul className="space-y-3">
            {candidates.map((c) => <CandidateCard key={c.linkId} candidate={c} />)}
          </ul>
        )
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-[160ms] ${active ? 'bg-primary-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'}`}
    >
      {children}
    </button>
  );
}

function CandidateCard({ candidate }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(null); // 'matches' | 'shortlist' | null
  const [matches, setMatches] = useState([]);
  const [shortlist, setShortlist] = useState([]);

  const toggle = async (which) => {
    if (open === which) { setOpen(null); return; }
    setOpen(which);
    try {
      if (which === 'matches') {
        const r = await api.get(`/guardian/candidate/${candidate.candidateId}/matches`);
        setMatches(r.data.matches || []);
      } else {
        const r = await api.get(`/guardian/candidate/${candidate.candidateId}/shortlisted`);
        setShortlist(r.data.shortlisted || []);
      }
    } catch {
      toast.error('Could not load');
    }
  };

  const list = open === 'matches' ? matches : shortlist;

  return (
    <li className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-neutral-800 dark:text-neutral-100 font-medium">{candidate.name}</p>
          <p className="text-xs text-neutral-400">{candidate.city} · {t('guardian.readOnly')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => toggle('matches')} className="inline-flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400">
            <FiHeart className="w-4 h-4" /> {t('guardian.viewMatches')}
          </button>
          {/* Shortlisting is a free action — gold is reserved for premium
              marks (doctrine §3.1), so this matches "View matches" instead
              of standing out as a false premium cue. */}
          <button onClick={() => toggle('shortlist')} className="inline-flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400">
            <FiStar className="w-4 h-4" /> {t('guardian.viewShortlist')}
          </button>
        </div>
      </div>
      {open && (
        <ul className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800 space-y-1.5">
          {list.length === 0 ? (
            <li className="text-sm text-neutral-400 flex items-center gap-1.5"><FiEye className="w-4 h-4" /> {t('common.empty')}</li>
          ) : list.map((m) => (
            <li key={m.matchId} className="text-sm text-neutral-600 dark:text-neutral-300">{m.name} · {m.city}</li>
          ))}
        </ul>
      )}
    </li>
  );
}
