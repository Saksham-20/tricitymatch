import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { FiUsers, FiUserPlus, FiTrash2, FiEye, FiHeart, FiStar } from 'react-icons/fi';

export default function Guardian() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('guardians');
  const [guardians, setGuardians] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmRevoke, setConfirmRevoke] = useState(null); // linkId pending confirmation

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [g, c] = await Promise.all([
        api.get('/guardian/my-guardians'),
        api.get('/guardian/my-candidates'),
      ]);
      setGuardians(g.data.guardians || []);
      setCandidates(c.data.candidates || []);
    } catch {
      // silent
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

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-1">
        <FiUsers className="w-7 h-7 text-primary-600" />
        <h1 className="text-2xl font-semibold text-neutral-800">{t('guardian.title')}</h1>
      </div>
      <p className="text-neutral-500 mb-6">{t('guardian.subtitle')}</p>

      <div className="flex gap-2 mb-6">
        <TabBtn active={tab === 'guardians'} onClick={() => setTab('guardians')}>{t('guardian.myGuardians')}</TabBtn>
        <TabBtn active={tab === 'candidates'} onClick={() => setTab('candidates')}>{t('guardian.myCandidates')}</TabBtn>
      </div>

      {tab === 'guardians' && (
        <>
          <form onSubmit={invite} className="flex gap-2 mb-6">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('guardian.inviteByEmail')}
              className="flex-1 px-4 py-2.5 rounded-lg border border-neutral-200"
            />
            <button
              type="submit"
              disabled={inviting}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60 font-medium"
            >
              <FiUserPlus className="w-4 h-4" /> {t('guardian.invite')}
            </button>
          </form>

          {loading ? (
            <p className="text-neutral-400">{t('common.loading')}</p>
          ) : guardians.length === 0 ? (
            <div className="bg-white border border-neutral-200 rounded-2xl py-12 px-6 text-center">
              <span className="w-12 h-12 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center mx-auto mb-3">
                <FiUsers className="w-5 h-5" />
              </span>
              <p className="text-sm text-neutral-500">{t('guardian.noGuardians')}</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {guardians.map((g) => (
                <li key={g.linkId} className="flex items-center justify-between bg-white border border-neutral-200 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-neutral-800 font-medium">{g.email}</p>
                    <span className={`text-xs capitalize ${g.status === 'active' ? 'text-success' : 'text-warning'}`}>{g.status}</span>
                  </div>
                  {confirmRevoke === g.linkId ? (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-neutral-500">Revoke access?</span>
                      <button onClick={() => revoke(g.linkId)} className="px-2.5 py-1 rounded-md bg-destructive text-white font-medium hover:bg-destructive/90">Yes</button>
                      <button onClick={() => setConfirmRevoke(null)} className="px-2.5 py-1 rounded-md bg-neutral-100 text-neutral-600 font-medium hover:bg-neutral-200">No</button>
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
          <p className="text-neutral-400">{t('common.loading')}</p>
        ) : candidates.length === 0 ? (
          <div className="bg-white border border-neutral-200 rounded-2xl py-12 px-6 text-center">
            <span className="w-12 h-12 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center mx-auto mb-3">
              <FiHeart className="w-5 h-5" />
            </span>
            <p className="text-sm text-neutral-500">{t('guardian.noCandidates')}</p>
          </div>
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
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
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
    <li className="bg-white border border-neutral-200 rounded-xl px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-neutral-800 font-medium">{candidate.name}</p>
          <p className="text-xs text-neutral-400">{candidate.city} · {t('guardian.readOnly')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => toggle('matches')} className="inline-flex items-center gap-1.5 text-sm text-primary-600">
            <FiHeart className="w-4 h-4" /> {t('guardian.viewMatches')}
          </button>
          <button onClick={() => toggle('shortlist')} className="inline-flex items-center gap-1.5 text-sm text-gold-600">
            <FiStar className="w-4 h-4" /> {t('guardian.viewShortlist')}
          </button>
        </div>
      </div>
      {open && (
        <ul className="mt-3 pt-3 border-t border-neutral-100 space-y-1.5">
          {list.length === 0 ? (
            <li className="text-sm text-neutral-400 flex items-center gap-1.5"><FiEye className="w-4 h-4" /> {t('common.empty')}</li>
          ) : list.map((m) => (
            <li key={m.matchId} className="text-sm text-neutral-600">{m.name} · {m.city}</li>
          ))}
        </ul>
      )}
    </li>
  );
}
