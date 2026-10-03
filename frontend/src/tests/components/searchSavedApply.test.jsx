/**
 * Applying a saved search must run THAT search (DISC-03), the filter panel must
 * only offer values the server accepts (DISC-09), and a 400 is reported as a
 * filter problem, not a server outage.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

// The page-level mock exposes the callbacks the real panel receives.
vi.mock('../../components/search', () => ({
  FilterPanel: ({ filters, onFilterChange, onApplySaved, onApply }) => (
    <div data-testid="filter-panel">
      <span data-testid="religion">{filters.religion}</span>
      <span data-testid="diet">{filters.diet}</span>
      <button onClick={() => onFilterChange({ name: 'diet', value: 'vegan' })}>set-diet</button>
      <button onClick={() => onFilterChange({ name: 'ageMin', value: '12' })}>set-bad-age</button>
      <button onClick={onApply}>apply</button>
      <button onClick={() => onApplySaved({ religion: 'Sikh', city: ['Mohali'], ageMin: 25, ageMax: 32, sortBy: 'age' })}>apply-saved</button>
    </div>
  ),
}));
vi.mock('../../components/cards', () => ({
  ProfileCard: ({ profile }) => <div data-testid="profile-card">{profile.firstName}</div>,
}));

import api from '../../api/axios';
import Search from '../../pages/Search';

const empty = { data: { profiles: [], pagination: { page: 1, pages: 1, total: 0 } } };
const lastQuery = () => new URLSearchParams(api.get.mock.calls.at(-1)[0].split('?')[1]);

beforeEach(() => { vi.clearAllMocks(); api.get.mockResolvedValue(empty); });

describe('applying a saved search', () => {
  it('requests the saved filters, replacing leftovers from the previous search', async () => {
    render(<MemoryRouter><Search /></MemoryRouter>);
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    fireEvent.click(screen.getByText('set-diet')); // a leftover filter from the last search
    expect(screen.getByTestId('diet').textContent).toBe('vegan');
    api.get.mockClear();

    fireEvent.click(screen.getByText('apply-saved'));
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    const q = lastQuery();
    expect(q.get('religion')).toBe('Sikh');
    expect(q.get('city')).toBe('Mohali');
    expect(q.get('ageMin')).toBe('25');
    expect(q.get('ageMax')).toBe('32');
    expect(q.get('sortBy')).toBe('age');
    expect(q.get('page')).toBe('1');
    expect(q.has('diet')).toBe(false); // not merged onto the leftover
    expect(screen.getByTestId('religion').textContent).toBe('Sikh');
    expect(screen.getByTestId('diet').textContent).toBe('');
  });
});

describe('a refused filter value', () => {
  it('says the filters need fixing instead of blaming the server', async () => {
    render(<MemoryRouter><Search /></MemoryRouter>);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    api.get.mockRejectedValue(Object.assign(new Error('bad'), { response: { status: 400 } }));

    fireEvent.click(screen.getByText('set-bad-age'));
    fireEvent.click(screen.getByText('apply'));

    await waitFor(() => expect(screen.getByText(/check your filters/i)).toBeInTheDocument());
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/the circle is still small/i)).not.toBeInTheDocument();
  });
});
