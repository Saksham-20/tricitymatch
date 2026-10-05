/**
 * Admin operations UI: the filtered audit log, moving leads between partners,
 * and the marketing manager's team page.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

const api = vi.hoisted(() => ({
  getAuditLog: vi.fn(), getAuditActions: vi.fn(), exportAuditLog: vi.fn(),
  assignLead: vi.fn(), reassignPartnerLeads: vi.fn(), getMarketingTeam: vi.fn(),
}));
const client = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const csv = vi.hoisted(() => ({ saveCsv: vi.fn() }));

vi.mock('../../api/adminApi', () => api);
vi.mock('../../api/apiClient', () => ({ default: client }));
vi.mock('react-hot-toast', () => ({ default: toast }));
vi.mock('../../utils/saveCsv', async (orig) => ({ ...(await orig()), saveCsv: csv.saveCsv }));

import AdminAuditLog from '../../pages/admin/AdminAuditLog';
import AdminLeads from '../../pages/admin/AdminLeads';
import ReassignLeadsDialog from '../../components/admin/ReassignLeadsDialog';
import MarketingTeam from '../../pages/marketing/MarketingTeam';

beforeEach(() => {
  vi.clearAllMocks();
  api.getAuditActions.mockResolvedValue({ data: { actions: [{ action: 'users_exported', count: 3 }, { action: 'user_status_changed', count: 12 }] } });
});
afterEach(cleanup);

const Where = () => { const l = useLocation(); return <p data-testid="where">{l.pathname + l.search}</p>; };

const entry = (over = {}) => ({
  id: 'e1', action: 'user_status_changed', createdAt: '2026-10-05T04:30:00Z',
  details: { previousStatus: 'active', newStatus: 'banned', reason: 'stolen photos' },
  Actor: { id: 'a1', email: 'admin@tricitymatch.com', role: 'admin' },
  TargetUser: { id: 'u1', email: 'asha@example.com', role: 'user' },
  ...over,
});
const auditPage = (entries, total = entries.length, pages = 1) => ({ data: { entries, pagination: { page: 1, limit: 50, total, pages } } });

const renderAudit = (url = '/admin/audit-log') => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes><Route path="/admin/audit-log" element={<><AdminAuditLog /><Where /></>} /></Routes>
  </MemoryRouter>,
);

describe('Audit log', () => {
  it('opens already filtered from a link (the member page sends ?target=)', async () => {
    api.getAuditLog.mockResolvedValue(auditPage([entry()]));
    renderAudit('/admin/audit-log?target=u1&action=user_status_changed');
    await screen.findByText('active → banned · "stolen photos"');
    expect(api.getAuditLog).toHaveBeenCalledWith(expect.objectContaining({ target: 'u1', action: 'user_status_changed', page: 1 }));
    expect(screen.getByLabelText('About (member email or ID)')).toHaveValue('u1');
    expect(screen.getByRole('link', { name: 'asha@example.com' })).toHaveAttribute('href', '/admin/users/u1');
    expect(screen.getByText('1 entry match')).toBeInTheDocument();
  });

  it('lists the actions that actually exist, with friendly names and counts', async () => {
    api.getAuditLog.mockResolvedValue(auditPage([entry()]));
    renderAudit();
    await screen.findByText('active → banned · "stolen photos"');
    const select = screen.getByLabelText('Action');
    await waitFor(() => expect(within(select).getByRole('option', { name: 'Members exported (3)' })).toBeInTheDocument());
  });

  it('applies the action and date filters straight away and puts them in the URL', async () => {
    api.getAuditLog.mockResolvedValue(auditPage([entry()]));
    renderAudit();
    await screen.findByText('active → banned · "stolen photos"');
    await waitFor(() => expect(within(screen.getByLabelText('Action')).getAllByRole('option').length).toBeGreaterThan(1));

    fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'users_exported' } });
    await waitFor(() => expect(api.getAuditLog).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'users_exported' })));
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-01' } });
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/admin/audit-log?action=users_exported&from=2026-10-01'));
  });

  it('applies the typed people filters on Apply', async () => {
    api.getAuditLog.mockResolvedValue(auditPage([entry()]));
    renderAudit();
    await screen.findByText('active → banned · "stolen photos"');
    fireEvent.change(screen.getByLabelText('Done by (email or part of it)'), { target: { value: ' priya@ ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(api.getAuditLog).toHaveBeenLastCalledWith(expect.objectContaining({ actor: 'priya@' })));
  });

  it('tells "nothing matches" from "nothing recorded", and clears the filters', async () => {
    api.getAuditLog.mockResolvedValue(auditPage([]));
    renderAudit('/admin/audit-log?actor=nobody');
    await screen.findByText('Nothing matches these filters.');
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]);
    await screen.findByText('Nothing recorded yet. Actions appear here as admins take them.');
    expect(screen.getByTestId('where').textContent).toBe('/admin/audit-log');
  });

  it('shows a retry, not an empty page, when the server fails', async () => {
    api.getAuditLog.mockRejectedValueOnce({ response: { data: { error: { message: 'Database is busy' } } } });
    renderAudit();
    await screen.findByText('Database is busy');
    api.getAuditLog.mockResolvedValue(auditPage([entry()]));
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('active → banned · "stolen photos"');
  });

  it('keeps the full record one click away, as readable JSON', async () => {
    api.getAuditLog.mockResolvedValue(auditPage([entry()]));
    renderAudit();
    await screen.findByText('Full record');
    expect(screen.getByText(/"newStatus": "banned"/)).toBeInTheDocument();
  });

  it('pages newest to oldest through the URL', async () => {
    api.getAuditLog.mockResolvedValue(auditPage([entry()], 120, 3));
    renderAudit();
    await screen.findByText('Page 1 of 3');
    fireEvent.click(screen.getByRole('button', { name: /Older/ }));
    await waitFor(() => expect(api.getAuditLog).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
    expect(screen.getByTestId('where').textContent).toBe('/admin/audit-log?page=2');
  });

  it('exports with the same filters (no page) and reports the count', async () => {
    api.getAuditLog.mockResolvedValue(auditPage([entry()]));
    api.exportAuditLog.mockResolvedValue({ data: new Blob(['x']), headers: {} });
    csv.saveCsv.mockResolvedValue({ expected: 120, incomplete: false });
    renderAudit('/admin/audit-log?action=user_status_changed&from=2026-10-01');
    await screen.findByText('active → banned · "stolen photos"');
    fireEvent.click(screen.getByRole('button', { name: /Export CSV/ }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Downloaded 120 audit rows.'));
    expect(api.exportAuditLog).toHaveBeenCalledWith({ action: 'user_status_changed', from: '2026-10-01' });
  });

  it('warns instead of celebrating when the export file stopped short', async () => {
    api.getAuditLog.mockResolvedValue(auditPage([entry()]));
    api.exportAuditLog.mockResolvedValue({ data: new Blob(['x']), headers: {} });
    csv.saveCsv.mockResolvedValue({ expected: 120, incomplete: true });
    renderAudit();
    await screen.findByText('active → banned · "stolen photos"');
    fireEvent.click(screen.getByRole('button', { name: /Export CSV/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/incomplete/)));
    expect(toast.success).not.toHaveBeenCalled();
  });
});

const partners = [
  { id: 'p1', email: 'rohit@example.com', status: 'active', Profile: { firstName: 'Rohit', lastName: 'Sethi' } },
  { id: 'p2', email: 'meera@example.com', status: 'active', Profile: { firstName: 'Meera' } },
  { id: 'p3', email: 'gone@example.com', status: 'inactive', Profile: null },
];

describe('Reassign leads dialog', () => {
  const open = (props = {}) => {
    client.get.mockResolvedValue({ data: { users: partners } });
    const onConfirm = vi.fn(async () => {});
    const onClose = vi.fn();
    render(<ReassignLeadsDialog title="Move open leads" excludeId="p1" onConfirm={onConfirm} onClose={onClose} {...props} />);
    return { onConfirm, onClose };
  };

  it('offers only other active partners', async () => {
    open();
    const select = await screen.findByLabelText('Give to');
    const options = within(select).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Choose a partner…', 'Meera · meera@example.com']); // not Rohit (the source), not the inactive one
  });

  it('will not submit without a choice, then hands the choice to the caller', async () => {
    const { onConfirm } = open();
    fireEvent.click(await screen.findByRole('button', { name: 'Move' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose who should take these leads');
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Give to'), { target: { value: 'p2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Move' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('p2'));
  });

  it('shows the server\'s reason inline and stays open when the move is refused', async () => {
    const onConfirm = vi.fn(async () => { throw { response: { data: { error: { message: 'That partner already has this person in their list' } } } }; });
    const { onClose } = open({ onConfirm });
    fireEvent.change(await screen.findByLabelText('Give to'), { target: { value: 'p2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Move' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('already has this person');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Move' })).toBeEnabled(); // can try someone else
  });

  it('explains when there is nobody to give them to', async () => {
    client.get.mockResolvedValue({ data: { users: [partners[0], partners[2]] } });
    render(<ReassignLeadsDialog title="Move" excludeId="p1" onConfirm={vi.fn()} onClose={vi.fn()} />);
    await screen.findByText(/no other active partner/);
    expect(screen.getByRole('button', { name: 'Move' })).toBeDisabled();
  });

  it('closes on Escape', async () => {
    const { onClose } = open();
    await screen.findByLabelText('Give to');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('Leads page', () => {
  const lead = (over) => ({ id: 'l1', name: 'Neha', phone: '9876500001', email: null, city: null, status: 'new', paymentStatus: 'none', assignedToMarketingUserId: 'p1', AssignedMarketer: { id: 'p1', email: 'rohit@example.com' }, convertedUserId: null, ...over });

  const renderLeads = (leads) => {
    client.get.mockImplementation(async (url) => {
      if (url.startsWith('/admin/leads')) return { data: { leads, pagination: { pages: 1 } } };
      return { data: { users: partners } };
    });
    return render(<MemoryRouter><AdminLeads /></MemoryRouter>);
  };

  it('offers Reassign for an open lead but not for one that already became a member', async () => {
    renderLeads([lead(), lead({ id: 'l2', name: 'Kabir', convertedUserId: 'u9', status: 'converted' })]);
    await screen.findByRole('cell', { name: 'Neha' });
    expect(screen.getAllByRole('button', { name: /Reassign/ })).toHaveLength(1);
    expect(screen.getByText('Stays with partner')).toBeInTheDocument();
  });

  it('moves a lead through the dialog and refreshes the list', async () => {
    api.assignLead.mockResolvedValue({ data: { message: 'Moved 1 lead.' } });
    renderLeads([lead()]);
    fireEvent.click(await screen.findByRole('button', { name: /Reassign/ }));
    fireEvent.change(await screen.findByLabelText('Give to'), { target: { value: 'p2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reassign' }));
    await waitFor(() => expect(api.assignLead).toHaveBeenCalledWith('l1', 'p2'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Moved 1 lead.'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

const team = (over = {}) => ({
  data: {
    partners: [
      { id: 'p1', name: 'Rohit Sethi', email: 'rohit@example.com', role: 'marketing', status: 'active', totalLeads: 20, signedUp: 8, paidMembers: 2, revenue: 2200, commissionRate: 20, commissionEarned: 440, activeCodes: 1, openLeads: 12, setup: { completed: 4, total: 4 } },
      { id: 'p2', name: 'Meera', email: 'meera@example.com', role: 'marketing_manager', status: 'active', totalLeads: 5, signedUp: 1, paidMembers: 1, revenue: 1100, commissionRate: 20, commissionEarned: 220, activeCodes: 1, openLeads: 4, setup: { completed: 2, total: 4 } },
      { id: 'p3', name: 'gone@example.com', email: 'gone@example.com', role: 'marketing', status: 'inactive', totalLeads: 0, signedUp: 0, paidMembers: 0, revenue: 0, commissionRate: 20, commissionEarned: 0, activeCodes: 0, openLeads: 0, setup: null },
    ],
    totals: { partners: 3, activePartners: 2, totalLeads: 25, signedUp: 9, paidMembers: 3, revenue: 3300, commissionEarned: 660, openLeads: 16 },
    truncated: false,
    ...over,
  },
});

describe('Marketing team page', () => {
  const names = () => screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0].querySelector('p').textContent);

  it('shows the team totals and every partner, highest revenue first', async () => {
    api.getMarketingTeam.mockResolvedValue(team());
    render(<MarketingTeam />);
    await screen.findByText('Rohit Sethi');
    expect(screen.getByText('₹3,300')).toBeInTheDocument();
    expect(screen.getByText('2 active')).toBeInTheDocument();
    expect(names()).toEqual(['Rohit Sethi', 'Meera', 'gone@example.com']);
    expect(screen.getByText('2 of 4')).toBeInTheDocument();
  });

  it('sorts by a column and flips direction on a second click', async () => {
    api.getMarketingTeam.mockResolvedValue(team());
    render(<MarketingTeam />);
    await screen.findByText('Rohit Sethi');
    fireEvent.click(screen.getByRole('button', { name: 'Partner' }));
    expect(names()).toEqual(['gone@example.com', 'Meera', 'Rohit Sethi']);
    fireEvent.click(screen.getByRole('button', { name: 'Partner' }));
    expect(names()).toEqual(['Rohit Sethi', 'Meera', 'gone@example.com']);
    expect(screen.getByRole('columnheader', { name: 'Partner' })).toHaveAttribute('aria-sort', 'descending');
  });

  it('searches by name or email', async () => {
    api.getMarketingTeam.mockResolvedValue(team());
    render(<MarketingTeam />);
    await screen.findByText('Rohit Sethi');
    fireEvent.change(screen.getByLabelText('Search partners'), { target: { value: 'meera@' } });
    expect(names()).toEqual(['Meera']);
    fireEvent.change(screen.getByLabelText('Search partners'), { target: { value: 'zzz' } });
    expect(await screen.findByText('Nobody matches that search')).toBeInTheDocument();
  });

  it('carries numbers only: no member or payout wording', async () => {
    api.getMarketingTeam.mockResolvedValue(team());
    const { container } = render(<MarketingTeam />);
    await screen.findByText('Rohit Sethi');
    expect(container.textContent).not.toMatch(/payout (details|balance)|UPI|PAN|phone/i);
  });

  it('says so, and does not retry forever, for someone who is not a manager', async () => {
    api.getMarketingTeam.mockRejectedValue({ response: { status: 403, data: { error: { message: 'The team view is for marketing managers.' } } } });
    render(<MarketingTeam />);
    await screen.findByText('This view is for marketing managers');
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('shows a retry on a server error, and an empty state with no partners', async () => {
    api.getMarketingTeam.mockRejectedValueOnce({ response: { status: 500, data: { error: { message: 'Boom' } } } });
    render(<MarketingTeam />);
    await screen.findByText('Boom');
    api.getMarketingTeam.mockResolvedValue(team({ partners: [], totals: { partners: 0 } }));
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('No partners yet');
  });
});
