/**
 * Read the server's error message out of a failed `responseType: 'blob'` request.
 *
 * Axios hands back a Blob for error responses too, so the usual
 * `err.response.data.error.message` reads `undefined` on a download and the
 * member sees a generic failure instead of "Invoice not available for a free
 * or granted plan". Parse the blob back into JSON before giving up.
 */
export default async function blobErrorMessage(err, fallback = 'Download failed') {
  const data = err?.response?.data;
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text());
      return parsed?.error?.message || parsed?.message || fallback;
    } catch {
      return fallback;
    }
  }
  return data?.error?.message || fallback;
}
