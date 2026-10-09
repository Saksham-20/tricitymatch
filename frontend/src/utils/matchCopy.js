import i18n from '../i18n';

// Shown when Save is tapped on someone the member already sent an interest to.
// The server keeps the interest (one state per pair), so say where they are.
export const keptLikeMessage = (data) => (data?.isMutual
  ? i18n.t('matches.keptLikeMutual')
  : i18n.t('matches.keptLikeSent'));
