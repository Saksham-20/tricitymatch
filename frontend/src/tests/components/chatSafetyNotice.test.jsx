import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SafetyNotice } from '../../components/chat/MessageBubble';

describe('SafetyNotice', () => {
  it('shows nothing for an unflagged message', () => {
    const { container } = render(<SafetyNotice flags={null} isSentByMe={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('warns the recipient about payment or phishing signals', () => {
    render(<SafetyNotice flags={['payment_request', 'external_link']} isSentByMe={false} />);
    expect(screen.getByRole('note')).toHaveTextContent(/never send money/i);
  });

  it('gives only a hint for a plain link', () => {
    render(<SafetyNotice flags={['external_link']} isSentByMe={false} />);
    const note = screen.getByRole('note');
    expect(note).toHaveTextContent(/only open links you trust/i);
    expect(note).not.toHaveTextContent(/never send money/i);
  });

  it('tells the sender when their message was flagged, and stays quiet for a plain link', () => {
    const { rerender } = render(<SafetyNotice flags={['upi_id']} isSentByMe />);
    expect(screen.getByText(/showed the other person a caution/i)).toBeInTheDocument();
    rerender(<SafetyNotice flags={['external_link']} isSentByMe />);
    expect(screen.queryByText(/caution/i)).toBeNull();
  });
});
