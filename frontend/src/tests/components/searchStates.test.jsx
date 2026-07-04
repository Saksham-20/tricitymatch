/**
 * Search error-vs-empty tests (2026-07 refinement pass).
 * A server failure renders the distinct error card ("your filters are fine"),
 * while a 404 / empty result set renders the empty card with clear-filters —
 * never the other way around.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

// Keep the test surface at the page level — the panel/card internals have
// their own concerns and drag in heavy dependencies.
vi.mock('../../components/search', () => ({
  FilterPanel: () => <div data-testid="filter-panel" />,
}));
vi.mock('../../components/cards', () => ({
  ProfileCard: ({ profile }) => <div data-testid="profile-card">{profile.firstName}</div>,
}));

import api from '../../api/axios';
import Search from '../../pages/Search';

const renderSearch = () => render(<MemoryRouter><Search /></MemoryRouter>);

beforeEach(() => vi.clearAllMocks());

describe('Search error vs empty', () => {
  it('renders the error card with retry on a server failure', async () => {
    api.get.mockRejectedValue(Object.assign(new Error('boom'), { response: { status: 500 } }));
    renderSearch();

    await waitFor(() => expect(screen.getByText(/something went wrong/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByText(/no profiles found/i)).not.toBeInTheDocument();
  });

  it('renders the empty card on 404 (backend "no results"), not the error card', async () => {
    api.get.mockRejectedValue(Object.assign(new Error('none'), { response: { status: 404 } }));
    renderSearch();

    await waitFor(() => expect(screen.getByText(/no profiles found/i)).toBeInTheDocument());
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });

  it('renders the empty card on a successful response with zero profiles', async () => {
    api.get.mockResolvedValue({ data: { profiles: [], pagination: { page: 1, pages: 1, total: 0 } } });
    renderSearch();

    await waitFor(() => expect(screen.getByText(/no profiles found/i)).toBeInTheDocument());
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });

  it('recovers: a successful retry after an error clears the error card', async () => {
    api.get.mockRejectedValueOnce(Object.assign(new Error('boom'), { response: { status: 500 } }));
    api.get.mockResolvedValue({
      data: {
        profiles: [{ id: 1, userId: 1, firstName: 'Simran', dateOfBirth: '1996-01-01' }],
        pagination: { page: 1, pages: 1, total: 1 },
      },
    });
    renderSearch();

    await waitFor(() => expect(screen.getByText(/something went wrong/i)).toBeInTheDocument());
    screen.getByRole('button', { name: /try again/i }).click();
    await waitFor(() => expect(screen.getByTestId('profile-card')).toBeInTheDocument());
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });
});
