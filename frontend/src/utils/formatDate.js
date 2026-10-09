import i18n from '../i18n';

// Month names follow the member's language (hi-IN / pa-IN keep Western digits).
const LOCALES = { en: 'en-IN', hi: 'hi-IN', pa: 'pa-IN' };
const locale = () => LOCALES[i18n.resolvedLanguage] || 'en-IN';

// "8 Oct 2026" for every date a member reads. A bare 8/10/2026 is ambiguous
// (8 October in India, August 10 to a browser in US English), and pages mixed
// both styles: "until 7 Nov 2026" sat above "valid until 11/7/2026".
export const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' });
};

// "8 Oct 2026, 1:52 pm" for timestamps staff read (audit trails, sign-ins).
export const formatDateTime = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(locale(), {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
};
