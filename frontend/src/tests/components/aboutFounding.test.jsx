import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

import About from '../../pages/About';

const renderAbout = () => render(
  <HelmetProvider><MemoryRouter><About /></MemoryRouter></HelmetProvider>
);

// The founding-member offer is off by choice and was removed from the site
// (2026-10-08): the stats band states only what is always true.
describe('About stats band (SITE-09)', () => {
  it('never promises free founding membership', () => {
    renderAbout();
    expect(screen.queryByText(/members join free/i)).toBeNull();
    expect(screen.queryByText(/founding/i)).toBeNull();
    expect(screen.getByText('Human-reviewed', { selector: 'div' })).toBeTruthy();
  });
});
