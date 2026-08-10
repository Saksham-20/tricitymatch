/**
 * Founding-window gate (Phase S).
 *
 * The whole point of this hook is that it FAILS CLOSED. If it ever defaulted to
 * open — or stayed open after a failed lookup — the landing page and the city
 * pages would promise a free premium period that `utils/foundingGrant.js` does
 * not issue while `FOUNDING_PERIOD_ENDS` is unset. That is precisely the class
 * of fabricated claim this whole refinement pass exists to remove, so it gets a
 * test rather than a comment.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('../../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

import api from '../../api/axios';
import useFoundingWindow, { __resetFoundingCache } from '../../hooks/useFoundingWindow';

const Probe = () => {
  const founding = useFoundingWindow();
  return (
    <div>
      <span data-testid="open">{String(founding.open)}</span>
      <span data-testid="ends">{founding.endsAt || 'none'}</span>
      <span data-testid="unlocks">{String(founding.contactUnlocks)}</span>
    </div>
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  __resetFoundingCache();
});

describe('useFoundingWindow', () => {
  it('starts closed before the server answers', () => {
    api.get.mockReturnValue(new Promise(() => {})); // never settles
    render(<Probe />);
    expect(screen.getByTestId('open')).toHaveTextContent('false');
  });

  it('stays closed when the request fails — never promises on a guess', async () => {
    api.get.mockRejectedValue(new Error('network'));
    render(<Probe />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.getByTestId('open')).toHaveTextContent('false');
    expect(screen.getByTestId('ends')).toHaveTextContent('none');
  });

  it('stays closed when the server reports the window closed, ignoring any endsAt echoed back', async () => {
    api.get.mockResolvedValue({ data: { founding: { open: false, endsAt: '2099-01-01', contactUnlocks: 5 } } });
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId('open')).toHaveTextContent('false'));
    expect(screen.getByTestId('ends')).toHaveTextContent('none');
  });

  it('opens only on an explicit server yes, carrying the date and the real unlock cap', async () => {
    api.get.mockResolvedValue({ data: { founding: { open: true, endsAt: '2026-12-31', contactUnlocks: 5 } } });
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId('open')).toHaveTextContent('true'));
    expect(screen.getByTestId('ends')).toHaveTextContent('2026-12-31');
    expect(screen.getByTestId('unlocks')).toHaveTextContent('5');
  });

  it('asks the server once no matter how many surfaces on the page ask', async () => {
    api.get.mockResolvedValue({ data: { founding: { open: true, endsAt: '2026-12-31' } } });
    render(<div><Probe /><Probe /><Probe /></div>);
    await waitFor(() => expect(screen.getAllByTestId('open')[0]).toHaveTextContent('true'));
    expect(api.get).toHaveBeenCalledTimes(1);
  });
});
