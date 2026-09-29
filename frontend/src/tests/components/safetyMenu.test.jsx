import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// The web app had no Report or Block control at all, although Terms, Safety and
// Help promise both. These pin the behaviour of the shared menu.

const mocks = vi.hoisted(() => ({
  reportMember: vi.fn(),
  blockMember: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('../../api/safety', () => ({
  reportMember: mocks.reportMember,
  blockMember: mocks.blockMember,
}));
vi.mock('react-hot-toast', () => ({ default: { success: mocks.toastSuccess, error: vi.fn() } }));

import SafetyMenu from '../../components/safety/SafetyMenu';

const USER = '22222222-2222-4222-8222-222222222222';

const open = (props = {}) => {
  render(<SafetyMenu userId={USER} name="Asha" {...props} />);
  fireEvent.click(screen.getByRole('button', { name: /more options for asha/i }));
};

const openReport = (props) => {
  open(props);
  fireEvent.click(screen.getByRole('menuitem', { name: /report asha/i }));
};

const openBlock = (props) => {
  open(props);
  fireEvent.click(screen.getByRole('menuitem', { name: /block asha/i }));
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.reportMember.mockResolvedValue({ success: true });
  mocks.blockMember.mockResolvedValue({ success: true });
});

describe('SafetyMenu', () => {
  it('renders nothing without a target', () => {
    const { container } = render(<SafetyMenu userId="" name="x" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('offers Report and Block, and is a labelled disclosure', () => {
    render(<SafetyMenu userId={USER} name="Asha" />);
    const trigger = screen.getByRole('button', { name: /more options for asha/i });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitem', { name: /report asha/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /block asha/i })).toBeInTheDocument();
  });

  it('closes the menu on Escape', () => {
    open();
    fireEvent.keyDown(document, { key: 'Escape' });
    return waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });
});

describe('report flow', () => {
  it('will not send without a reason', async () => {
    openReport();
    fireEvent.click(screen.getByRole('button', { name: /send report/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/choose what happened/i);
    expect(mocks.reportMember).not.toHaveBeenCalled();
  });

  it('sends the chosen reason and details, then confirms', async () => {
    openReport();
    fireEvent.click(screen.getByLabelText(/asks for money or looks like a scam/i));
    fireEvent.change(screen.getByLabelText(/anything else/i), { target: { value: 'asked for a deposit' } });
    fireEvent.click(screen.getByRole('button', { name: /send report/i }));

    await waitFor(() => expect(mocks.reportMember).toHaveBeenCalledWith(USER, 'financial_scam', 'asked for a deposit'));
    expect(await screen.findByText(/report received/i)).toBeInTheDocument();
    expect(screen.getByText(/not told who reported them/i)).toBeInTheDocument();
  });

  it('points at emergency help for a threat', async () => {
    openReport();
    fireEvent.click(screen.getByLabelText(/threats or i feel unsafe/i));
    fireEvent.click(screen.getByRole('button', { name: /send report/i }));
    expect(await screen.findByText(/call 112/i)).toBeInTheDocument();
  });

  it('offers every category the platform needs, safety-critical first', () => {
    openReport();
    const labels = screen.getAllByRole('radio').map((r) => r.closest('label').textContent);
    expect(labels[0]).toMatch(/threats/i);
    for (const expected of [/harassment/i, /scam/i, /fake profile/i, /someone else's photos/i, /legal age/i, /inappropriate/i, /misleading/i, /spam/i, /something else/i]) {
      expect(labels.some((l) => expected.test(l))).toBe(true);
    }
  });

  it('keeps the dialog and shows the error when sending fails', async () => {
    mocks.reportMember.mockRejectedValue({ response: { status: 500, data: { error: { message: 'Server hiccup' } } } });
    openReport();
    fireEvent.click(screen.getByLabelText(/spam or advertising/i));
    fireEvent.click(screen.getByRole('button', { name: /send report/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/server hiccup/i);
    expect(screen.queryByText(/report received/i)).not.toBeInTheDocument();
  });

  it('says so plainly when rate limited', async () => {
    mocks.reportMember.mockRejectedValue({ response: { status: 429, data: {} } });
    openReport();
    fireEvent.click(screen.getByLabelText(/spam or advertising/i));
    fireEvent.click(screen.getByRole('button', { name: /send report/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/too many actions/i);
  });

  it('says so when the network is down', async () => {
    mocks.reportMember.mockRejectedValue(new Error('Network Error'));
    openReport();
    fireEvent.click(screen.getByLabelText(/spam or advertising/i));
    fireEvent.click(screen.getByRole('button', { name: /send report/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't reach the server/i);
  });

  it('closes on Escape', async () => {
    openReport();
    expect(screen.getByRole('dialog', { name: /report asha/i })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('block flow', () => {
  it('explains what blocking does before doing it', () => {
    openBlock();
    const dialog = screen.getByRole('alertdialog', { name: /block asha\?/i });
    expect(dialog).toHaveTextContent(/neither of you can message or call/i);
    expect(dialog).toHaveTextContent(/not told/i);
    expect(mocks.blockMember).not.toHaveBeenCalled();
  });

  it('blocks on confirm, tells the caller, and confirms with a toast', async () => {
    const onBlocked = vi.fn();
    openBlock({ onBlocked });
    fireEvent.click(screen.getByRole('button', { name: /^block$/i }));
    await waitFor(() => expect(mocks.blockMember).toHaveBeenCalledWith(USER));
    await waitFor(() => expect(onBlocked).toHaveBeenCalledTimes(1));
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Asha is blocked');
  });

  it('does nothing when cancelled', async () => {
    const onBlocked = vi.fn();
    openBlock({ onBlocked });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(mocks.blockMember).not.toHaveBeenCalled();
    expect(onBlocked).not.toHaveBeenCalled();
  });

  it('does not report success when blocking fails', async () => {
    mocks.blockMember.mockRejectedValue({ response: { status: 500, data: {} } });
    const onBlocked = vi.fn();
    openBlock({ onBlocked });
    fireEvent.click(screen.getByRole('button', { name: /^block$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't block/i);
    expect(onBlocked).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it('a submitted report can lead straight to blocking', async () => {
    openReport();
    fireEvent.click(screen.getByLabelText(/harassment or abuse/i));
    fireEvent.click(screen.getByRole('button', { name: /send report/i }));
    fireEvent.click(await screen.findByRole('button', { name: /also block asha/i }));
    expect(await screen.findByRole('alertdialog', { name: /block asha\?/i })).toBeInTheDocument();
  });
});
