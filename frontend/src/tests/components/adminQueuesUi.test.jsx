/**
 * Moderation and support queues: a report review links both members, shows the
 * chat captured with the report, can ban the reported member (with a reason),
 * and counts down urgent reports; the support inbox opens on unread, oldest
 * first; and a failed load never reads as "all clear".
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

const api = vi.hoisted(() => ({
  getReports: vi.fn(), updateReport: vi.fn(), getEvidenceList: vi.fn(), getEvidenceRecord: vi.fn(),
  updateUserStatus: vi.fn(), updateUserVisibility: vi.fn(),
  getSuspicious: vi.fn(), getModerationStats: vi.fn(), getPhotoQueue: vi.fn(), removePhoto: vi.fn(),
  getMediaReviews: vi.fn(), decideMediaReview: vi.fn(),
  getAuditLog: vi.fn(), getAuditActions: vi.fn(), exportAuditLog: vi.fn(),
  getAppeals: vi.fn(), decideAppeal: vi.fn(),
}));
const client = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const scopes = vi.hoisted(() => ({ value: null }));

vi.mock('../../api/adminApi', () => api);
vi.mock('../../api/apiClient', () => ({ default: client }));
vi.mock('react-hot-toast', () => ({ default: toast }));
vi.mock('../../components/admin/AdminLayout', () => ({ useAdminScopes: () => scopes.value }));

import AdminReports from '../../pages/admin/AdminReports';
import AdminSafety from '../../pages/admin/AdminSafety';
import AdminContactMessages from '../../pages/admin/AdminContactMessages';
import AdminAuditLog from '../../pages/admin/AdminAuditLog';
import AdminPhotoReview from '../../pages/admin/AdminPhotoReview';
import AdminAppeals, { suspensionText } from '../../pages/admin/AdminAppeals';
import { reportDeadline, deadlineLabel } from '../../components/admin/ReportDeadline';

const HOUR = 60 * 60 * 1000;

beforeEach(() => {
  vi.clearAllMocks();
  scopes.value = null;
  api.getEvidenceList.mockResolvedValue({ data: { evidence: [] } });
});
afterEach(cleanup);

const report = (over = {}) => ({
  id: 'r1', reporterId: 'u-rep', reportedUserId: 'u-bad', reason: 'threats', priority: 'urgent', status: 'pending',
  description: 'He said he knows where I live', createdAt: new Date(Date.now() - 30 * HOUR).toISOString(),
  otherReports: 2, otherOpenReports: 1,
  Reporter: { id: 'u-rep', email: 'asha@example.com', Profile: { firstName: 'Asha', lastName: 'Verma' } },
  ReportedUser: { id: 'u-bad', email: null, phone: '9888800011', role: 'user', status: 'active', invisible: false, Profile: { firstName: 'Rohit', lastName: 'Kumar' } },
  ...over,
});
const reportsPage = (rows) => ({ data: { reports: rows, pagination: { page: 1, pages: 1, total: rows.length } } });

const renderReports = () => render(<MemoryRouter><AdminReports /></MemoryRouter>);
const openReview = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Review' }));
  return screen.getByRole('dialog');
};
// The evidence panel loads on its own; let it finish before the test ends.
const evidenceSettled = (dialog) => within(dialog).findByText(/Nothing was kept for this report/);

describe('Report review', () => {
  it('links both members and says how often the member was reported, for an admin who can open members', async () => {
    api.getReports.mockResolvedValue(reportsPage([report()]));
    renderReports();
    const dialog = await openReview();
    expect(within(dialog).getByRole('link', { name: 'Asha Verma' })).toHaveAttribute('href', '/admin/users/u-rep');
    expect(within(dialog).getByRole('link', { name: 'Rohit Kumar' })).toHaveAttribute('href', '/admin/users/u-bad');
    expect(within(dialog).getByText('2 other reports against this member (1 still open)')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /ban member/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /make invisible/i })).toBeInTheDocument();
    await evidenceSettled(dialog);
  });

  it('a reports-only sub-admin sees plain names and no ban or hide', async () => {
    scopes.value = ['reports'];
    api.getReports.mockResolvedValue(reportsPage([report()]));
    renderReports();
    const dialog = await openReview();
    expect(within(dialog).getByText('Asha Verma')).toBeInTheDocument();
    expect(within(dialog).queryAllByRole('link')).toHaveLength(0);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(within(dialog).queryByRole('button', { name: /ban member/i })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: /make invisible/i })).toBeNull();
    await evidenceSettled(dialog);
  });

  it('shows the chat captured when the report was filed, read-only', async () => {
    api.getReports.mockResolvedValue(reportsPage([report()]));
    api.getEvidenceList.mockImplementation(async (params) => ({
      data: {
        evidence: params.reportId
          ? [{ id: 'ev1', reportId: 'r1', subjectUserId: 'u-bad', source: 'report_filed', messageCount: 2, createdAt: '2026-10-10T10:00:00Z', preserveUntil: '2027-04-08T10:00:00Z' }]
          : [],
      },
    }));
    api.getEvidenceRecord.mockResolvedValue({
      data: {
        evidence: {
          id: 'ev1', subjectUserId: 'u-bad', reportId: 'r1',
          payload: {
            source: 'report_filed',
            messages: [
              { id: 'm1', senderId: 'u-bad', receiverId: 'u-rep', content: 'I know where you live', createdAt: '2026-10-10T09:00:00Z' },
              { id: 'm2', senderId: 'u-rep', receiverId: 'u-bad', content: 'Please stop', createdAt: '2026-10-10T09:01:00Z' },
            ],
          },
        },
      },
    });
    renderReports();
    const dialog = await openReview();
    fireEvent.click(await within(dialog).findByRole('button', { name: /chat captured when the report was filed/i }));
    expect(await within(dialog).findByText('I know where you live')).toBeInTheDocument();
    expect(within(dialog).getByText('Please stop')).toBeInTheDocument();
    expect(within(dialog).getByText('Rohit Kumar (reported)')).toBeInTheDocument();
    expect(within(dialog).getByText('Asha Verma (reporter)')).toBeInTheDocument();
    expect(api.getEvidenceList).toHaveBeenCalledWith({ reportId: 'r1' });
    expect(api.getEvidenceList).toHaveBeenCalledWith({ userId: 'u-bad' });
    expect(api.getEvidenceRecord).toHaveBeenCalledWith('ev1');
    expect(within(dialog).queryByRole('textbox', { name: /message/i })).toBeNull();
  });

  it('says plainly when nothing was captured, and offers a retry when evidence fails to load', async () => {
    api.getReports.mockResolvedValue(reportsPage([report()]));
    api.getEvidenceList.mockRejectedValueOnce(new Error('down'));
    renderReports();
    const dialog = await openReview();
    expect(await within(dialog).findByText(/Could not load the evidence/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Retry' }));
    expect(await within(dialog).findByText(/Nothing was kept for this report/)).toBeInTheDocument();
  });

  it('banning the reported member needs a reason, then bans and refreshes the queue', async () => {
    api.getReports.mockResolvedValue(reportsPage([report()]));
    api.updateUserStatus.mockResolvedValue({ data: { success: true } });
    renderReports();
    const dialog = await openReview();
    await evidenceSettled(dialog);
    fireEvent.click(within(dialog).getByRole('button', { name: /ban member/i }));
    const confirm = within(dialog).getByRole('button', { name: 'Confirm ban' });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText('Reason for the ban'), { target: { value: 'rude' } });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText('Reason for the ban'), { target: { value: 'Threatening messages' } });
    fireEvent.click(confirm);
    await waitFor(() => expect(api.updateUserStatus).toHaveBeenCalledWith('u-bad', { status: 'banned', reason: 'Threatening messages' }));
    await waitFor(() => expect(api.getReports).toHaveBeenCalledTimes(2));
    expect(await within(dialog).findByText('This account is banned.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /ban member/i })).toBeDisabled();
  });

  it('making the member invisible also needs a reason', async () => {
    api.getReports.mockResolvedValue(reportsPage([report()]));
    api.updateUserVisibility.mockResolvedValue({ data: { success: true } });
    renderReports();
    const dialog = await openReview();
    await evidenceSettled(dialog);
    fireEvent.click(within(dialog).getByRole('button', { name: /make invisible/i }));
    const confirm = within(dialog).getByRole('button', { name: 'Make invisible' });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/only admins see this/i), { target: { value: 'checking this report' } });
    fireEvent.click(confirm);
    await waitFor(() => expect(api.updateUserVisibility).toHaveBeenCalledWith('u-bad', { hidden: true, reason: 'checking this report' }));
  });
});

describe('Reports queue filters', () => {
  const Address = () => <span data-testid="address">{useLocation().search}</span>;
  const renderAt = (entry) => render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes><Route path="/admin/reports" element={<><AdminReports /><Address /></>} /></Routes>
    </MemoryRouter>,
  );
  const lastQuery = () => api.getReports.mock.calls.at(-1)[0];

  it('opens on every report still waiting on a decision', async () => {
    api.getReports.mockResolvedValue(reportsPage([]));
    renderAt('/admin/reports');
    await waitFor(() => expect(api.getReports).toHaveBeenCalled());
    expect(lastQuery()).toMatchObject({ status: 'open' });
    expect(lastQuery()).not.toHaveProperty('priority');
    expect(screen.getByRole('button', { name: 'open' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('a link with ?priority=urgent opens the urgent open reports, and unticking clears it from the address', async () => {
    api.getReports.mockResolvedValue(reportsPage([report()]));
    renderAt('/admin/reports?priority=urgent');
    await screen.findByRole('button', { name: 'Review' });
    expect(api.getReports).toHaveBeenCalledWith(expect.objectContaining({ status: 'open', priority: 'urgent' }));
    const urgent = screen.getByRole('checkbox', { name: 'Urgent only' });
    expect(urgent).toBeChecked();
    fireEvent.click(urgent);
    await waitFor(() => expect(screen.getByTestId('address').textContent).toBe(''));
    await waitFor(() => expect(lastQuery()).not.toHaveProperty('priority'));
    expect(lastQuery()).toMatchObject({ status: 'open' });
  });

  it('keeps the chosen tab in the address', async () => {
    api.getReports.mockResolvedValue(reportsPage([]));
    renderAt('/admin/reports');
    await waitFor(() => expect(api.getReports).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'resolved' }));
    await waitFor(() => expect(screen.getByTestId('address').textContent).toBe('?status=resolved'));
    await waitFor(() => expect(lastQuery()).toMatchObject({ status: 'resolved' }));
    fireEvent.click(screen.getByRole('button', { name: 'all' }));
    await waitFor(() => expect(lastQuery()).not.toHaveProperty('status'));
  });
});

describe('Urgent report clock', () => {
  const now = Date.parse('2026-10-11T12:00:00Z');
  const filed = (hoursAgo) => new Date(now - hoursAgo * HOUR).toISOString();

  it('counts 24 hours from filing and says by how much a report is late', () => {
    const late = reportDeadline({ priority: 'urgent', status: 'pending', createdAt: filed(30) }, now);
    expect(late.overdue).toBe(true);
    expect(deadlineLabel(late)).toBe('Overdue by 6 h');
    expect(deadlineLabel(reportDeadline({ priority: 'urgent', status: 'reviewing', createdAt: filed(3 + 20 / 60) }, now))).toBe('Due in 20 h');
    expect(deadlineLabel(reportDeadline({ priority: 'urgent', status: 'pending', createdAt: filed(23.5) }, now))).toBe('Due in 30 min');
  });

  it('has no clock for a normal report or one that is closed', () => {
    expect(reportDeadline({ priority: 'normal', status: 'pending', createdAt: filed(30) }, now)).toBeNull();
    expect(reportDeadline({ priority: 'urgent', status: 'resolved', createdAt: filed(30) }, now)).toBeNull();
  });

  it('shows the overdue chip in the queue', async () => {
    api.getReports.mockResolvedValue(reportsPage([report()]));
    renderReports();
    expect((await screen.findAllByText(/Overdue by 6 h/)).length).toBeGreaterThan(0);
  });
});

describe('Trust & Safety', () => {
  it('a failed load of suspicious accounts says so with a retry, never "nothing suspicious"', async () => {
    api.getSuspicious.mockRejectedValueOnce({ response: { status: 500 } });
    render(<MemoryRouter><AdminSafety /></MemoryRouter>);
    expect(await screen.findByText('Could not load suspicious accounts.')).toBeInTheDocument();
    expect(screen.queryByText(/No account matches a suspicious pattern/)).toBeNull();
    api.getSuspicious.mockResolvedValue({ data: { accounts: [] } });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('No account matches a suspicious pattern right now.')).toBeInTheDocument();
  });
});

describe('Support inbox', () => {
  const enquiry = (over = {}) => ({
    id: 'c1', name: 'Neha', email: 'neha@example.com', phone: null, subject: 'Cannot log in', message: 'Help please',
    status: 'new', createdAt: '2026-10-10T08:00:00Z', memberId: 'u9', memberMatch: 'email', ...over,
  });
  const listUrl = () => client.get.mock.calls.map((c) => c[0]).filter((u) => u.startsWith('/admin/contact-messages')).pop();
  const renderInbox = (entry = '/admin/contact-messages') => render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes><Route path="/admin/contact-messages" element={<AdminContactMessages />} /></Routes>
    </MemoryRouter>,
  );
  const serve = (list) => client.get.mockImplementation(async (url) => {
    if (url.startsWith('/admin/support-staff')) return { data: { staff: [] } };
    if (list instanceof Error) throw list;
    return { data: { messages: list, newCount: list.filter((m) => m.status === 'new').length, pagination: { pages: 1, total: list.length } } };
  });

  it('opens on unread enquiries, oldest first, links the member account, and opening one marks it read', async () => {
    serve([enquiry()]);
    client.put.mockResolvedValue({ data: { success: true } });
    renderInbox();
    await screen.findByText('Cannot log in');
    expect(listUrl()).toContain('status=new');
    expect(listUrl()).toContain('sort=oldest');
    expect(screen.getByRole('link', { name: /member account/i })).toHaveAttribute('href', '/admin/users/u9');
    fireEvent.click(screen.getByText('Cannot log in'));
    await waitFor(() => expect(client.put).toHaveBeenCalledWith('/admin/contact-messages/c1', { status: 'read' }));
    expect(screen.getByText('Help please')).toBeInTheDocument();
  });

  it('reads its filters from the address, so a link opens the same view', async () => {
    serve([enquiry({ status: 'read', repliedAt: null })]);
    renderInbox('/admin/contact-messages?status=all&replied=no&sort=newest');
    await screen.findByText('Cannot log in');
    expect(listUrl()).not.toContain('status=');
    expect(listUrl()).toContain('replied=no');
    expect(listUrl()).toContain('sort=newest');
    expect(screen.getByLabelText('Filter by reply')).toHaveValue('no');
  });

  it('a failed load shows a retry, not an empty inbox', async () => {
    serve(Object.assign(new Error('x'), { response: { data: { error: { message: 'Database is busy' } } } }));
    renderInbox();
    expect(await screen.findByText('Database is busy')).toBeInTheDocument();
    expect(screen.queryByText(/No enquiries found|No unread enquiries/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('Audit log', () => {
  it('names a member with no email by name and phone', async () => {
    api.getAuditActions.mockResolvedValue({ data: { actions: [] } });
    api.getAuditLog.mockResolvedValue({
      data: {
        entries: [{
          id: 'e1', action: 'user_status_changed', createdAt: '2026-10-10T04:30:00Z', details: {},
          Actor: { id: 'a1', email: 'admin@tricitymatch.com', role: 'admin' },
          TargetUser: { id: 'u5', email: null, phone: '9888800011', role: 'user', Profile: { firstName: 'Zorawar', lastName: 'Gill' } },
        }],
        pagination: { page: 1, limit: 50, total: 1, pages: 1 },
      },
    });
    render(
      <MemoryRouter initialEntries={['/admin/audit-log']}>
        <Routes><Route path="/admin/audit-log" element={<AdminAuditLog />} /></Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('link', { name: 'Zorawar Gill · 9888800011' })).toHaveAttribute('href', '/admin/users/u5');
    expect(screen.getByRole('button', { name: 'Apply' }).className).toMatch(/bg-primary-700/);
  });
});

describe('Photo review', () => {
  it('shows decisions as well as the waiting queue, each linked to the member', async () => {
    api.getMediaReviews.mockResolvedValueOnce({ data: { reviews: [] } });
    render(<MemoryRouter><AdminPhotoReview /></MemoryRouter>);
    await screen.findByText('Nothing waiting');
    api.getMediaReviews.mockResolvedValue({
      data: {
        reviews: [{
          id: 'mr1', userId: 'u7', url: 'https://res.cloudinary.com/x/p.jpg', source: 'auto', status: 'rejected',
          decidedAt: '2026-10-10T06:00:00Z', decisionNote: 'Not the member', labels: [], member: { firstName: 'Priya', lastName: 'S' },
        }],
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Rejected' }));
    await waitFor(() => expect(api.getMediaReviews).toHaveBeenLastCalledWith({ status: 'rejected', source: 'auto' }));
    expect(await screen.findByRole('link', { name: 'Priya S' })).toHaveAttribute('href', '/admin/users/u7');
    expect(screen.getByText(/Removed on/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
  });
});

describe('Appeals', () => {
  it('spells out why the member was suspended', () => {
    expect(suspensionText({ status: 'banned', reason: 'Asked members for money', at: '2026-10-01T05:00:00Z', byEmail: 'admin@tricitymatch.com', bulk: false }))
      .toMatch(/^Banned on .+ by admin@tricitymatch\.com\. Reason: Asked members for money$/);
    expect(suspensionText({ status: 'banned', at: '2026-10-01T05:00:00Z', bulk: true })).toMatch(/bulk change\. No reason was recorded\.$/);
    expect(suspensionText(null)).toBe('No suspension record was found for this account.');
  });

  it('a member who appealed by phone is told by the reviewer, and the confirmation says so', async () => {
    api.getAppeals.mockResolvedValue({
      data: {
        appeals: [{
          id: 'a1', userId: 'u5', email: '+919888800011', statement: 'Please look at my account again.', status: 'pending',
          createdAt: '2026-10-10T08:00:00Z', suspension: null,
          User: { id: 'u5', email: null, phone: '9888800011', status: 'banned', Profile: { firstName: 'Simran', lastName: 'Kaur' } },
        }],
      },
    });
    api.decideAppeal.mockResolvedValue({ data: { success: true, emailed: false } });
    render(<MemoryRouter><AdminAppeals /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Review' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/cannot be emailed/)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/Note to the member/), { target: { value: 'Checked the chats, all fine.' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Restore account' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Account restored — call or message them on +919888800011'));
    await waitFor(() => expect(api.getAppeals).toHaveBeenCalledTimes(2));
  });
});
