import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import MatchPopup from '../components/matching/MatchPopup';

const MatchCelebrationContext = createContext(null);

/**
 * Anything that sends an interest calls `celebrate(profile)` when the server
 * answers `newMatch: true`. The API has always said so; the web ignored it, so
 * a member learned they had matched only from a notification, and the popup
 * component was exported and mounted nowhere.
 *
 * `profile` is whatever the caller has for the other member
 * ({ userId | id, firstName, lastName, profilePhoto }).
 */
export const MatchCelebrationProvider = ({ children }) => {
  const [matched, setMatched] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  const celebrate = useCallback((profile) => {
    if (profile) setMatched(profile);
  }, []);
  const close = useCallback(() => setMatched(null), []);

  const value = useMemo(() => ({ celebrate }), [celebrate]);
  const me = user?.Profile || user?.profile || user;
  const otherId = matched?.userId || matched?.id;

  return (
    <MatchCelebrationContext.Provider value={value}>
      {children}
      <MatchPopup
        isOpen={Boolean(matched)}
        onClose={close}
        currentUser={me}
        matchedUser={matched}
        onChat={() => { const id = otherId; close(); if (id) navigate(`/chat?to=${id}`); }}
        onContinue={close}
      />
    </MatchCelebrationContext.Provider>
  );
};

/** Safe outside the provider (tests, isolated components): celebrate is a no-op. */
export const useMatchCelebration = () => useContext(MatchCelebrationContext) || { celebrate: () => {} };
