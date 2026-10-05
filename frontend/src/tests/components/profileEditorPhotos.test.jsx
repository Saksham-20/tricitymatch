/**
 * Photos in the profile editor (owner report: "deleting photos does not delete
 * sometimes the main photo"). The editor used the signup photo step, whose
 * remove button only cleared the form: the save never sent it and the main
 * photo stayed live behind a "Profile updated" toast. The editor now uses the
 * gallery manager, which deletes on the server, and the form save never sends
 * a photo back.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), del: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('../../api/axios', () => ({ default: { get: mocks.get, put: mocks.put, delete: mocks.del } }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(mocks.info, { success: mocks.success, error: mocks.error }) }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));

import ModernProfileEditor from '../../pages/ModernProfileEditor';

const MAIN = 'https://res.cloudinary.com/demo/image/upload/main.jpg';
const OTHER = 'https://res.cloudinary.com/demo/image/upload/other.jpg';
const stored = { profilePhoto: MAIN, photos: [MAIN, OTHER] };

const profileWith = (photos) => ({
  firstName: 'Asha', lastName: 'Verma', gender: 'female', dateOfBirth: '1996-04-12', city: 'Mohali', ...photos,
});

beforeEach(() => {
  vi.clearAllMocks();
  window.history.pushState({}, '', '/profile/edit?section=photos');
  mocks.get.mockResolvedValue({ data: { profile: profileWith(stored) } });
  mocks.del.mockResolvedValue({ data: { success: true, photos: [OTHER], profilePhoto: OTHER } });
  mocks.put.mockResolvedValue({ data: { success: true, photosUnderReview: 0 } });
});

afterEach(() => { window.history.pushState({}, '', '/'); });

const openPhotos = async () => {
  render(<MemoryRouter><ModernProfileEditor /></MemoryRouter>);
  return screen.findByRole('button', { name: /delete photo 1/i }, { timeout: 3000 });
};

describe('profile editor photos', () => {
  it('removing the main photo deletes it on the server and shows the new main', async () => {
    const deleteMain = await openPhotos();
    expect(screen.getByAltText('Main photo')).toHaveAttribute('src', expect.stringContaining('main.jpg'));

    // After the delete the gallery refreshes from the server.
    mocks.get.mockResolvedValue({ data: { profile: profileWith({ profilePhoto: OTHER, photos: [OTHER] }) } });
    fireEvent.click(deleteMain);
    expect(screen.getByRole('status')).toHaveTextContent(/next photo becomes your main photo/i);
    fireEvent.click(screen.getByRole('button', { name: /confirm delete/i }));

    await waitFor(() => expect(mocks.del).toHaveBeenCalledWith('/profile/me/photo', { data: { photoUrl: MAIN } }));
    await waitFor(() => expect(screen.getByAltText('Main photo')).toHaveAttribute('src', expect.stringContaining('other.jpg')));
    expect(mocks.success).toHaveBeenCalledWith('Photo deleted');
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('a failed delete says why instead of claiming success', async () => {
    mocks.del.mockRejectedValue({ response: { data: { error: { message: 'Photo not found in gallery' } } } });
    fireEvent.click(await openPhotos());
    fireEvent.click(screen.getByRole('button', { name: /confirm delete/i }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('Photo not found in gallery'));
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it('saving the form never sends a main photo back', async () => {
    await openPhotos();
    fireEvent.click(screen.getByRole('button', { name: /make main/i }));
    await waitFor(() => expect(mocks.put).toHaveBeenCalledTimes(1));
    expect(mocks.put.mock.calls[0][1].get('profilePhoto')).toBe(OTHER);

    fireEvent.click(screen.getByRole('button', { name: /save profile/i }));
    await waitFor(() => expect(mocks.put).toHaveBeenCalledTimes(2));
    const formSave = mocks.put.mock.calls[1][1];
    expect(formSave.has('profilePhoto')).toBe(false);
    expect(formSave.has('photos')).toBe(false);
    expect(formSave.get('firstName')).toBe('Asha');
  });
});
