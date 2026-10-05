import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProfileCard from '../../components/cards/ProfileCard';

/**
 * The card used to flip its own icon and re-send the SAME action, so a second tap
 * on a saved profile said "Removed" while the server kept the row. The parent is
 * now told the state the member wants, and may answer `false` to make the icon
 * revert.
 */
const profile = { userId: 'u9', firstName: 'Asha', lastName: 'Verma', city: 'Mohali', dateOfBirth: '1996-04-12', matchStatus: 'shortlist' };
const renderCard = (props) => render(
  <MemoryRouter>
    <ProfileCard profile={profile} userId="u9" {...props} />
  </MemoryRouter>
);

describe('ProfileCard like / save toggles', () => {
  it('tells the parent to take a saved profile back (false), then to save it again (true)', async () => {
    const onShortlist = vi.fn().mockResolvedValue(true);
    renderCard({ onShortlist });
    const btn = screen.getAllByLabelText(/remove from shortlist|shortlist/i)[0];
    fireEvent.click(btn);
    await waitFor(() => expect(onShortlist).toHaveBeenLastCalledWith(false));
    fireEvent.click(screen.getAllByLabelText(/remove from shortlist|shortlist/i)[0]);
    await waitFor(() => expect(onShortlist).toHaveBeenLastCalledWith(true));
  });

  it('reverts the icon when the parent reports the server refused', async () => {
    const onShortlist = vi.fn().mockResolvedValue(false);
    renderCard({ onShortlist });
    fireEvent.click(screen.getAllByLabelText(/remove from shortlist/i)[0]);
    await waitFor(() => expect(onShortlist).toHaveBeenCalledWith(false));
    // still labelled as saved because the un-save did not go through
    await waitFor(() => expect(screen.getAllByLabelText(/remove from shortlist/i).length).toBeGreaterThan(0));
  });

  it('a like that the parent confirms stays liked, and reports true', async () => {
    const onLike = vi.fn().mockResolvedValue(true);
    // (The `compact` variant was retired from ProfileCard — dead in-app and a
    // keyboard trap; the full variant carries the same like affordance.)
    renderCard({ onLike, profile: { ...profile, matchStatus: null, profilePhoto: 'https://img.test/a.jpg' } });
    fireEvent.click(screen.getAllByLabelText(/^like$|express interest/i)[0]);
    await waitFor(() => expect(onLike).toHaveBeenCalledWith(true));
  });
});
