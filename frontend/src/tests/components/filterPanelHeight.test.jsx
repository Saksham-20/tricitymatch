/**
 * Search filters: a height pair (the server always filtered on heightMin /
 * heightMax, the panel had no control for them), a min-above-max pair is
 * stopped in the panel, and "Filters applied" only shows when the search
 * actually went through.
 */
import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));
vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'me', role: 'user', Profile: { firstName: 'Ravi' } } }),
}));
vi.mock('../../components/cards', () => ({
  ProfileCard: ({ profile }) => <div data-testid="profile-card">{profile.firstName}</div>,
}));

import api from '../../api/axios';
import toast from 'react-hot-toast';
import FilterPanel, { HEIGHT_OPTIONS, rangeErrors } from '../../components/search/FilterPanel';
import Search from '../../pages/Search';

// The panel is controlled by its parent; this stands in for Search.
const Harness = ({ initial = {}, onApply }) => {
  const [filters, setFilters] = useState(initial);
  return (
    <FilterPanel
      filters={filters}
      onFilterChange={({ name, value }) => setFilters((f) => ({ ...f, [name]: value }))}
      onApply={onApply}
      onClear={() => setFilters({})}
    />
  );
};

const applyButton = () => screen.getAllByRole('button', { name: /apply filters/i })[0];

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => Promise.resolve(
    String(url).startsWith('/search')
      ? { data: { profiles: [], pagination: { page: 1, pages: 1, total: 0 } } }
      : { data: { savedSearches: [] } }
  ));
});

describe('height filter', () => {
  it('offers 4\'6" to 7\'0" in cm, the same list as the profile editor', () => {
    expect(HEIGHT_OPTIONS[0]).toEqual({ value: '137', label: `4'6" (137 cm)` });
    expect(HEIGHT_OPTIONS[HEIGHT_OPTIONS.length - 1]).toEqual({ value: '213', label: `7'0" (213 cm)` });
    expect(HEIGHT_OPTIONS).toHaveLength(31);
  });

  it('has a min and max height control that set heightMin / heightMax', () => {
    const onFilterChange = vi.fn();
    render(<FilterPanel filters={{}} onFilterChange={onFilterChange} onApply={() => {}} onClear={() => {}} />);
    const min = screen.getByLabelText('Min Height');
    const max = screen.getByLabelText('Max Height');
    expect(within(min).getByRole('option', { name: `5'0" (152 cm)` })).toBeInTheDocument();
    fireEvent.change(min, { target: { value: '152' } });
    fireEvent.change(max, { target: { value: '178' } });
    expect(onFilterChange).toHaveBeenCalledWith({ name: 'heightMin', value: '152' });
    expect(onFilterChange).toHaveBeenCalledWith({ name: 'heightMax', value: '178' });
  });
});

describe('min above max', () => {
  it('rangeErrors flags each inverted pair and nothing else', () => {
    expect(rangeErrors({ ageMin: '35', ageMax: '30' })).toEqual({ age: 'ageOrder' });
    expect(rangeErrors({ heightMin: '180', heightMax: '160' })).toEqual({ height: 'heightOrder' });
    expect(rangeErrors({ ageMin: '30', ageMax: '30', heightMin: '160' })).toEqual({});
    expect(rangeErrors({})).toEqual({});
  });

  it('stops Apply and says which pair is wrong', () => {
    const onApply = vi.fn();
    render(<Harness initial={{ heightMin: '180', heightMax: '160' }} onApply={onApply} />);
    fireEvent.click(applyButton());
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent("Min height can't be more than max height.");
    expect(screen.getByLabelText('Min Height')).toHaveAttribute('aria-invalid', 'true');
  });

  it('clears the message once the pair is edited, and applies when it is right', () => {
    const onApply = vi.fn();
    render(<Harness initial={{ ageMin: '40', ageMax: '30' }} onApply={onApply} />);
    fireEvent.click(applyButton());
    expect(screen.getByRole('alert')).toHaveTextContent("Min age can't be more than max age.");

    fireEvent.change(screen.getByLabelText('Maximum age'), { target: { value: '45' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(applyButton());
    expect(onApply).toHaveBeenCalledTimes(1);
  });
});

describe('Search: the "Filters applied" toast', () => {
  const renderSearch = () => render(<MemoryRouter><Search /></MemoryRouter>);

  it('does not search or toast when min age is above max age', async () => {
    renderSearch();
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    const searchesBefore = api.get.mock.calls.filter(([u]) => String(u).startsWith('/search?')).length;

    fireEvent.change(screen.getByLabelText('Minimum age'), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText('Maximum age'), { target: { value: '30' } });
    fireEvent.click(applyButton());

    expect(screen.getByRole('alert')).toHaveTextContent("Min age can't be more than max age.");
    expect(api.get.mock.calls.filter(([u]) => String(u).startsWith('/search?'))).toHaveLength(searchesBefore);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('does not toast when the server refuses the filters', async () => {
    renderSearch();
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    api.get.mockImplementation((url) => (String(url).startsWith('/search?')
      ? Promise.reject(Object.assign(new Error('bad'), { response: { status: 400 } }))
      : Promise.resolve({ data: { savedSearches: [] } })));

    fireEvent.change(screen.getByLabelText('Minimum age'), { target: { value: '25' } });
    fireEvent.click(applyButton());

    expect(await screen.findByText('Check your filters')).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('toasts once the search goes through', async () => {
    renderSearch();
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText('Min Height'), { target: { value: '152' } });
    fireEvent.click(applyButton());
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Filters applied'));
    expect(api.get.mock.calls.some(([u]) => String(u).includes('heightMin=152'))).toBe(true);
  });
});
