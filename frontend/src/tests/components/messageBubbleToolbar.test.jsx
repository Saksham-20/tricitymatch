/**
 * The chat message toolbar (react / reply / edit / delete) is revealed by a
 * mouse hover through Tailwind classes. Tailwind only generates a class it can
 * read whole in the source, so a class glued together at runtime from a shared
 * prefix never reaches the stylesheet: the toolbar showed on hover but every
 * click fell through to the bubble.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import MessageBubble from '../../components/chat/MessageBubble';

const HOVER_CLICKABLE = '[@media(hover:hover)_and_(pointer:fine)]:group-hover:pointer-events-auto';
const HOVER_VISIBLE = '[@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100';

const noop = vi.fn();
const renderBubble = () =>
  render(
    <MessageBubble
      message={{ id: 'm1', senderId: 'me', content: 'Hello', createdAt: new Date().toISOString() }}
      myUserId="me"
      canRich
      canEdit
      isEditing={false}
      editContent=""
      setEditContent={noop}
      editInputRef={{ current: null }}
      onStartEdit={noop}
      onCancelEdit={noop}
      onSaveEdit={noop}
      showDeleteConfirm={false}
      onAskDelete={noop}
      onConfirmDelete={noop}
      onCancelDelete={noop}
      pickerOpen={false}
      onOpenPicker={noop}
      onClosePicker={noop}
      onReact={noop}
      onReply={noop}
      onLockedAffordance={noop}
    />
  );

describe('MessageBubble hover toolbar', () => {
  it('carries the hover classes that make it visible AND clickable', () => {
    renderBubble();
    const toolbar = screen.getByRole('button', { name: 'Delete message' }).parentElement;
    const classes = toolbar.className.split(/\s+/);
    expect(classes).toContain(HOVER_CLICKABLE);
    expect(classes).toContain(HOVER_VISIBLE);
  });

  it('spells both hover classes out in full in the source, where Tailwind can see them', () => {
    const source = readFileSync(resolve(__dirname, '../../components/chat/MessageBubble.jsx'), 'utf8');
    expect(source).toContain(HOVER_CLICKABLE);
    expect(source).toContain(HOVER_VISIBLE);
    // A prefix constant joined to a utility at runtime is what broke it.
    expect(source).not.toMatch(/\$\{[A-Z_]+\}:[a-z-]/);
  });
});
