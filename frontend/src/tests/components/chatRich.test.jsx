/**
 * Phase B chat rich features — component-level tests for the pieces with
 * real logic: the reply meter (DS3 escalation), the paywalled composer
 * (DS1 variants), reaction pills (toggle affordance + counts), and the
 * message dedupe-by-id rule the socket handlers rely on.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import ReplyMeter from '../../components/chat/ReplyMeter';
import PaywalledComposer from '../../components/chat/PaywalledComposer';
import { ReactionPills, REACTION_EMOJIS } from '../../components/chat/ReactionBar';

const HOUR = 60 * 60 * 1000;

describe('ReplyMeter (DS3)', () => {
  it('renders nothing without a window or when inactive', () => {
    const { container: a } = render(<ReplyMeter replyWindow={null} />);
    expect(a).toBeEmptyDOMElement();
    const { container: b } = render(
      <ReplyMeter replyWindow={{ active: false, messagesRemaining: 0, expiresAt: null }} />
    );
    expect(b).toBeEmptyDOMElement();
  });

  it('shows the remaining count, neutral above 2', () => {
    render(<ReplyMeter replyWindow={{ active: true, messagesRemaining: 4, expiresAt: null }} />);
    const el = screen.getByText(/4 free replies left/i);
    expect(el.parentElement.className).toContain('text-neutral-400');
  });

  it('escalates to the warning tone at ≤2 remaining', () => {
    render(
      <ReplyMeter replyWindow={{ active: true, messagesRemaining: 1, expiresAt: new Date(Date.now() + HOUR).toISOString() }} />
    );
    const el = screen.getByText(/1 free reply left/i);
    expect(el.parentElement.className).toContain('text-gold-700');
    expect(el.parentElement).toHaveAttribute('aria-live', 'polite');
  });
});

describe('PaywalledComposer (DS1)', () => {
  const renderIt = (reason) =>
    render(
      <MemoryRouter>
        <PaywalledComposer name="Priya Sharma" avatarUrl={null} reason={reason} />
      </MemoryRouter>
    );

  it('exhausted variant says the 5 free replies are used', () => {
    renderIt('exhausted');
    expect(screen.getByText(/used your 5 free replies/i)).toBeInTheDocument();
  });

  it('expired variant says the 48-hour window ended', () => {
    renderIt('expired');
    expect(screen.getByText(/48-hour reply window ended/i)).toBeInTheDocument();
  });

  it('CTA names the person, never a bare "Upgrade"', () => {
    renderIt('exhausted');
    const cta = screen.getByRole('link');
    expect(cta.textContent).toMatch(/Keep talking with Priya/);
    expect(cta.getAttribute('href')).toBe('/subscription');
  });
});

describe('ReactionPills', () => {
  it('renders counts and marks own reaction; toggle fires for premium', () => {
    const onToggle = vi.fn();
    render(
      <ReactionPills
        reactions={{ '❤️': ['me', 'them'], '👍': ['them'] }}
        myUserId="me"
        canReact
        onToggle={onToggle}
      />
    );
    fireEvent.click(screen.getByLabelText(/❤️ 2 \(you reacted\)/));
    expect(onToggle).toHaveBeenCalledWith('❤️');
  });

  it('is inert for free members (DS7: neutral, no action)', () => {
    const onToggle = vi.fn();
    render(<ReactionPills reactions={{ '🙏': ['them'] }} myUserId="me" canReact={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByLabelText(/🙏 1/));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('allowlist matches the shared six', () => {
    expect(REACTION_EMOJIS).toEqual(['❤️', '😂', '😮', '😢', '👍', '🙏']);
  });
});

describe('message dedupe-by-id (socket contract)', () => {
  // The reducer rule Chat.jsx applies on message:new — the server emits to the
  // pair room AND the personal room, so every receiver sees each event twice.
  const addMessage = (prev, message, myId) => {
    if (prev.some((m) => m.id === message.id)) return prev;
    if (message.senderId === myId) return prev;
    return [...prev, message];
  };

  it('drops the duplicate second delivery', () => {
    const m = { id: 'a', senderId: 'them' };
    let state = [];
    state = addMessage(state, m, 'me');
    state = addMessage(state, m, 'me');
    expect(state).toHaveLength(1);
  });

  it('skips own messages (already appended from the REST response)', () => {
    expect(addMessage([], { id: 'b', senderId: 'me' }, 'me')).toHaveLength(0);
  });
});
