import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('../../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'admin', features: {} } }) }));

import api from '../../api/axios';
import InviteLink from '../../components/common/InviteLink';

describe('InviteLink for staff accounts', () => {
  it('renders nothing and never asks for a link (staff have no invite link)', () => {
    for (const variant of ['card', 'row', 'inline']) {
      const { container, unmount } = render(<InviteLink variant={variant} />);
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
    expect(api.get).not.toHaveBeenCalled();
  });
});
