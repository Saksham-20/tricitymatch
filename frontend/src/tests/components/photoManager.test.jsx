import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), del: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('../../api/axios', () => ({ default: { get: mocks.get, put: mocks.put, delete: mocks.del } }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(mocks.info, { success: mocks.success, error: mocks.error }) }));

import PhotoManager, { orderedPhotos, MAX_PHOTOS } from '../../components/profile/PhotoManager';

const profile = (photos, profilePhoto = photos[0]) => ({ profilePhoto, photos });
const file = (name, type = 'image/jpeg', size = 1000) => new File([new Uint8Array(size)], name, { type });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.put.mockResolvedValue({ data: { success: true, photosUnderReview: 0 } });
  mocks.del.mockResolvedValue({ data: { success: true } });
  mocks.get.mockResolvedValue({ data: { profile: profile(['https://x/a.jpg', 'https://x/b.jpg']) } });
});

describe('orderedPhotos', () => {
  it('puts the main photo first and drops duplicates', () => {
    expect(orderedPhotos({ profilePhoto: 'b', photos: ['a', 'b', 'c'] })).toEqual(['b', 'a', 'c']);
    expect(orderedPhotos({ profilePhoto: null, photos: ['a'] })).toEqual(['a']);
    expect(orderedPhotos(undefined)).toEqual([]);
  });
});

describe('PhotoManager', () => {
  it('shows the count, marks the main photo and offers Make main only on the others', () => {
    render(<PhotoManager profile={profile(['https://x/a.jpg', 'https://x/b.jpg'])} />);
    expect(screen.getByText(`2 of ${MAX_PHOTOS}`)).toBeInTheDocument();
    expect(screen.getByText('Main photo')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /make main/i })).toHaveLength(1);
  });

  it('cannot delete the only photo', () => {
    render(<PhotoManager profile={profile(['https://x/a.jpg'])} />);
    expect(screen.getByRole('button', { name: /delete photo 1/i })).toBeDisabled();
  });

  it('delete needs a second tap, then calls DELETE with the photo url and refreshes', async () => {
    const onChange = vi.fn();
    render(<PhotoManager profile={profile(['https://x/a.jpg', 'https://x/b.jpg'])} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /delete photo 2/i }));
    expect(mocks.del).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /confirm delete/i }));
    await waitFor(() => expect(mocks.del).toHaveBeenCalledWith('/profile/me/photo', { data: { photoUrl: 'https://x/b.jpg' } }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(mocks.success).toHaveBeenCalledWith('Photo deleted');
  });

  it('Make main sends the chosen url as profilePhoto', async () => {
    render(<PhotoManager profile={profile(['https://x/a.jpg', 'https://x/b.jpg'])} />);
    fireEvent.click(screen.getByRole('button', { name: /make main/i }));
    await waitFor(() => expect(mocks.put).toHaveBeenCalled());
    const [path, fd] = mocks.put.mock.calls[0];
    expect(path).toBe('/profile/me');
    expect(fd.get('profilePhoto')).toBe('https://x/b.jpg');
  });

  it('uploads picked images in the photos field and refuses non-images and oversize files', async () => {
    const { container } = render(<PhotoManager profile={profile(['https://x/a.jpg'])} />);
    const input = container.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [file('ok.jpg'), file('doc.pdf', 'application/pdf'), file('huge.jpg', 'image/jpeg', 6 * 1024 * 1024)] } });
    await waitFor(() => expect(mocks.put).toHaveBeenCalledTimes(1));
    const fd = mocks.put.mock.calls[0][1];
    expect(fd.getAll('photos').map((f) => f.name)).toEqual(['ok.jpg']);
    expect(mocks.error).toHaveBeenCalled();
  });

  it('hides the Add tile at the six-photo limit', () => {
    const six = ['a', 'b', 'c', 'd', 'e', 'f'].map((n) => `https://x/${n}.jpg`);
    render(<PhotoManager profile={profile(six)} />);
    expect(screen.queryByText(/add photo/i)).not.toBeInTheDocument();
  });

  it('tells the member when new photos are held for review', async () => {
    mocks.put.mockResolvedValue({ data: { success: true, photosUnderReview: 1 } });
    const { container } = render(<PhotoManager profile={profile(['https://x/a.jpg'])} />);
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file('new.jpg')] } });
    await waitFor(() => expect(mocks.info).toHaveBeenCalledWith(expect.stringMatching(/checked by our team/i), expect.anything()));
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it('shows the server message when a change fails', async () => {
    mocks.del.mockRejectedValue({ response: { data: { error: { message: 'Photo not found in gallery' } } } });
    render(<PhotoManager profile={profile(['https://x/a.jpg', 'https://x/b.jpg'])} />);
    fireEvent.click(screen.getByRole('button', { name: /delete photo 2/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm delete/i }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('Photo not found in gallery'));
  });
});
