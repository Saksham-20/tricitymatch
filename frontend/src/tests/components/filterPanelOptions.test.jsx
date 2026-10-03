/**
 * The filter panel offers only values the server accepts and filters on its
 * canonical vocabularies (DISC-01, DISC-09, DISC-15), and saves the whole
 * filter set (DISC-18).
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../api/axios', () => ({
  default: { get: vi.fn().mockResolvedValue({ data: { savedSearches: [] } }), post: vi.fn(), delete: vi.fn() },
}));

import api from '../../api/axios';
import FilterPanel from '../../components/search/FilterPanel';

const optionValues = (select) => within(select).getAllByRole('option').map((o) => o.value);

describe('FilterPanel', () => {
  // Desktop and mobile copies both mount; the first of each id is enough.
  const renderPanel = () => {
    render(<FilterPanel filters={{}} onFilterChange={() => {}} onApply={() => {}} onClear={() => {}} />);
    // Background, Education & Career and Lifestyle start collapsed.
    ['Background', 'Education & Career', 'Lifestyle'].forEach((name) => fireEvent.click(screen.getByRole('button', { name })));
  };

  it('profession is a dropdown of the canonical groups', () => {
    renderPanel();
    const select = document.querySelector('select#profession');
    expect(select).toBeTruthy();
    const values = optionValues(select);
    expect(values).toEqual(expect.arrayContaining(['', 'Software / IT', 'Engineer', 'Doctor / Healthcare', 'Other']));
  });

  it('caste is a dropdown of the known communities', () => {
    renderPanel();
    const select = document.querySelector('select#caste');
    expect(select).toBeTruthy();
    expect(optionValues(select)).toEqual(expect.arrayContaining(['', 'Jatt', 'Khatri', 'Bhati', 'Bhatia']));
  });

  it('does not offer diet or drinking values the server rejects, nor ages above 99', () => {
    renderPanel();
    expect(optionValues(document.querySelector('select#diet'))).not.toContain('eggetarian');
    expect(optionValues(document.querySelector('select#drinking'))).not.toContain('socially');
    document.querySelectorAll('input#ageMin, input#ageMax').forEach((i) => {
      expect(i.getAttribute('max')).toBe('99');
      expect(i.getAttribute('min')).toBe('18');
    });
    expect(screen.queryAllByText('Eggetarian')).toHaveLength(0);
  });
});

describe('saving a search', () => {
  it('saves every filter on screen, not just five of them', async () => {
    api.post.mockResolvedValue({ data: { savedSearch: { id: 's1', name: 'Mine', filters: { a: 1, b: 2, c: 3 } } } });
    const filters = { religion: 'Hindu', education: 'Master', profession: 'Software / IT', diet: 'vegetarian', ageMin: '25', city: 'Mohali', verifiedOnly: 'true', caste: '' };
    render(<FilterPanel filters={filters} onFilterChange={() => {}} onApply={() => {}} onClear={() => {}} onApplySaved={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: /save this search/i }));
    fireEvent.change(screen.getByLabelText(/saved search name/i), { target: { value: 'Mine' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(api.post.mock.calls[0][1]).toEqual({
      name: 'Mine',
      filters: { religion: 'Hindu', education: 'Master', profession: 'Software / IT', diet: 'vegetarian', ageMin: 25, city: ['Mohali'], verifiedOnly: 'true' },
    });
  });
});
