import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

const mockFounding = vi.fn();
vi.mock('../../hooks/useFoundingWindow', () => ({ default: () => mockFounding() }));

import About from '../../pages/About';

const renderAbout = () => render(
  <HelmetProvider><MemoryRouter><About /></MemoryRouter></HelmetProvider>
);

describe('About stats band (SITE-09)', () => {
  beforeEach(() => mockFounding.mockReset());

  it('does not promise free membership while the founding window is closed', () => {
    mockFounding.mockReturnValue({ open: false, loading: false });
    renderAbout();
    expect(screen.queryByText(/members join free/i)).toBeNull();
    expect(screen.getByText('Human-reviewed', { selector: 'div' })).toBeTruthy();
  });

  it('shows the founding line when the server says the window is open', () => {
    mockFounding.mockReturnValue({ open: true, loading: false });
    renderAbout();
    expect(screen.getByText(/members join free/i)).toBeTruthy();
  });
});
