import { describe, it, expect } from 'vitest';
import api from '../../api/axios';

// Run the response interceptor's rejection handler directly.
const reject = (error) => api.interceptors.response.handlers.find((h) => h && h.rejected).rejected(error);

describe('axios error normalisation (SITE-08)', () => {
  it('mirrors error.message to data.message so call sites that read either see the reason', async () => {
    const err = { config: { url: '/contact' }, response: { status: 429, data: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many messages, try again in an hour' } } } };
    await expect(reject(err)).rejects.toBe(err);
    expect(err.response.data.message).toBe('Too many messages, try again in an hour');
    expect(err.response.data.error.message).toBe('Too many messages, try again in an hour');
  });

  it('leaves an existing top-level message and non-JSON bodies alone', async () => {
    const a = { config: { url: '/x' }, response: { status: 400, data: { message: 'top', error: { message: 'inner' } } } };
    await expect(reject(a)).rejects.toBe(a);
    expect(a.response.data.message).toBe('top');
    const b = { config: { url: '/x' }, response: { status: 500, data: 'Bad gateway' } };
    await expect(reject(b)).rejects.toBe(b);
    expect(b.response.data).toBe('Bad gateway');
  });
});
