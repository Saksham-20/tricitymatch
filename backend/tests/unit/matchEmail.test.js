/** MATCH-12: the mutual-match mail uses the branded, escaped template. */
const mockDeliver = jest.fn(async () => true);
jest.mock('../../utils/email', () => ({
  sendEmail: (...a) => mockDeliver(...a),
  sendMatchNotification: (to, name, matchName) => mockDeliver(to, 'matchNotification', { name, matchName }),
}));

const { sendMatchNotification } = require('../../utils/emailService');

describe('legacy sendMatchNotification', () => {
  beforeEach(() => mockDeliver.mockClear());

  it('sends the branded matchNotification template to the recipient by first name', async () => {
    await sendMatchNotification('a@example.test', 'Riya Sharma', 'https://x/profile/1', 'Aman');
    expect(mockDeliver).toHaveBeenCalledWith('a@example.test', 'matchNotification', { name: 'Aman', matchName: 'Riya Sharma' });
  });

  it('does nothing when the member has no email address', async () => {
    expect(await sendMatchNotification(null, 'Riya', 'u', 'Aman')).toBe(false);
    expect(mockDeliver).not.toHaveBeenCalled();
  });
});
