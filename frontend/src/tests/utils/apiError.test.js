import { describe, it, expect } from 'vitest';
import apiErrorMessage from '../../utils/apiError';

describe('apiErrorMessage (CHAT-22)', () => {
  it('reads the real envelope { error: { message } }', () => {
    const err = { response: { data: { success: false, error: { code: 'CONFLICT', message: 'Maximum 3 guardians allowed' } } } };
    expect(apiErrorMessage(err, 'Invite failed')).toBe('Maximum 3 guardians allowed');
  });
  it('still accepts a flat { message } body', () => {
    expect(apiErrorMessage({ response: { data: { message: 'Nope' } } }, 'x')).toBe('Nope');
  });
  it('falls back when there is no response (network error)', () => {
    expect(apiErrorMessage(new Error('Network Error'), 'Invite failed')).toBe('Invite failed');
  });
});
