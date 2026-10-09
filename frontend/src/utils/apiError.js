/**
 * The API's error envelope is `{ success:false, error:{ code, message } }`.
 * Reading `response.data.message` (the old, flat shape) is always undefined, so
 * the member saw only the generic fallback and lost the real reason ("Maximum 3
 * guardians allowed", "Password is incorrect"). Read it in one place.
 */
import i18n from '../i18n';

export default function apiErrorMessage(err, fallback = i18n.t('errors.generic')) {
  const data = err?.response?.data;
  return data?.error?.message || data?.message || fallback;
}
