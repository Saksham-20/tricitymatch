import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { Profile: { firstName: 'Asha', lastName: 'Verma' } } }),
}));

import { MatchCelebrationProvider, useMatchCelebration } from '../../context/MatchCelebrationContext';

const Where = () => <div data-testid="where">{useLocation().pathname + useLocation().search}</div>;
const Trigger = ({ profile }) => {
  const { celebrate } = useMatchCelebration();
  return <button onClick={() => celebrate(profile)}>match!</button>;
};

const setup = (profile) => render(
  <MemoryRouter initialEntries={['/search']}>
    <MatchCelebrationProvider>
      <Trigger profile={profile} />
      <Where />
    </MatchCelebrationProvider>
  </MemoryRouter>
);

beforeEach(() => vi.clearAllMocks());

describe('MatchCelebrationProvider', () => {
  it('shows nothing until a match is announced', () => {
    setup({ userId: 'u2', firstName: 'Rohan', lastName: 'Singh' });
    expect(screen.queryByText(/it.s a match/i)).not.toBeInTheDocument();
  });

  it('opens the popup with the other member when celebrate() is called', async () => {
    setup({ userId: 'u2', firstName: 'Rohan', lastName: 'Singh' });
    fireEvent.click(screen.getByText('match!'));
    expect(await screen.findByText(/it.s a match/i)).toBeInTheDocument();
    expect(screen.getByText(/Rohan/)).toBeInTheDocument();
  });

  it('Message goes to the chat thread with that member and closes the popup', async () => {
    setup({ userId: 'u2', firstName: 'Rohan', lastName: 'Singh' });
    fireEvent.click(screen.getByText('match!'));
    const btn = await screen.findByRole('button', { name: /message|chat|send/i });
    await act(async () => { fireEvent.click(btn); });
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/chat?to=u2'));
    await waitFor(() => expect(screen.queryByText(/it.s a match/i)).not.toBeInTheDocument());
  });

  it('useMatchCelebration is a harmless no-op outside the provider', () => {
    const Lone = () => { useMatchCelebration().celebrate({ userId: 'x' }); return <p>ok</p>; };
    render(<Lone />);
    expect(screen.getByText('ok')).toBeInTheDocument();
  });
});
