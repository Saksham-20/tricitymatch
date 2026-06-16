/**
 * Route-guard tests (QA-1). These directly exercise the role logic that the
 * FE-1 bug got wrong — super_admin must reach the admin UI, plain users must not.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Mock useAuth so we can drive the guards with arbitrary auth states.
const mockAuth = { isAuthenticated: false, loading: false, user: null };
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

import AdminProtectedRoute from '../../components/admin/AdminProtectedRoute';
import ProtectedRoute from '../../components/common/ProtectedRoute';

const setAuth = (state) => Object.assign(mockAuth, state);

const renderAt = (initial, element) =>
  render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path={initial} element={element} />
        <Route path="/login" element={<div>LOGIN PAGE</div>} />
        <Route path="/dashboard" element={<div>DASHBOARD</div>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => setAuth({ isAuthenticated: false, loading: false, user: null }));

describe('AdminProtectedRoute', () => {
  it('allows role=admin', () => {
    setAuth({ isAuthenticated: true, user: { role: 'admin' } });
    renderAt('/admin', <AdminProtectedRoute><div>ADMIN UI</div></AdminProtectedRoute>);
    expect(screen.getByText('ADMIN UI')).toBeInTheDocument();
  });

  it('allows role=super_admin (FE-1 regression)', () => {
    setAuth({ isAuthenticated: true, user: { role: 'super_admin' } });
    renderAt('/admin', <AdminProtectedRoute><div>ADMIN UI</div></AdminProtectedRoute>);
    expect(screen.getByText('ADMIN UI')).toBeInTheDocument();
  });

  it('redirects a plain user to /login', () => {
    setAuth({ isAuthenticated: true, user: { role: 'user' } });
    renderAt('/admin', <AdminProtectedRoute><div>ADMIN UI</div></AdminProtectedRoute>);
    expect(screen.getByText('LOGIN PAGE')).toBeInTheDocument();
  });

  it('redirects an unauthenticated visitor to /login', () => {
    renderAt('/admin', <AdminProtectedRoute><div>ADMIN UI</div></AdminProtectedRoute>);
    expect(screen.getByText('LOGIN PAGE')).toBeInTheDocument();
  });
});

describe('ProtectedRoute adminOnly', () => {
  it('allows super_admin through adminOnly (FE-1 regression)', () => {
    setAuth({ isAuthenticated: true, user: { role: 'super_admin' } });
    renderAt('/x', <ProtectedRoute adminOnly><div>SECRET</div></ProtectedRoute>);
    expect(screen.getByText('SECRET')).toBeInTheDocument();
  });

  it('bounces a plain user from an adminOnly route to /dashboard', () => {
    setAuth({ isAuthenticated: true, user: { role: 'user' } });
    renderAt('/x', <ProtectedRoute adminOnly><div>SECRET</div></ProtectedRoute>);
    expect(screen.getByText('DASHBOARD')).toBeInTheDocument();
  });

  it('lets any authenticated user through a non-admin protected route', () => {
    setAuth({ isAuthenticated: true, user: { role: 'user' } });
    renderAt('/x', <ProtectedRoute><div>MEMBER AREA</div></ProtectedRoute>);
    expect(screen.getByText('MEMBER AREA')).toBeInTheDocument();
  });
});
