/**
 * The API's error envelope is `{ success:false, error:{ code, message } }`.
 * Reading `response.data.message` (the old, flat shape) is always undefined, so
 * the member saw only the generic fallback and lost the real reason ("Maximum 3
 * guardians allowed", "Password is incorrect"). Read it in one place.
 */
export default function apiErrorMessage(err, fallback = 'Something went wrong') {
  const data = err?.response?.data;
  return data?.error?.message || data?.message || fallback;
}
