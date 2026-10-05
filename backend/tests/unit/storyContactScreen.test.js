/**
 * Public success stories are published pages, so the profile-text rule applies:
 * no phone numbers, emails, links or handles in them.
 */
const mockCreate = jest.fn(async (d) => ({ id: 's1', ...d }));
jest.mock('../../models', () => ({ ContactMessage: {}, SuccessStory: { create: (...a) => mockCreate(...a) } }));
jest.mock('../../utils/email', () => ({ sendEmail: jest.fn() }));

const { submitSuccessStory } = require('../../controllers/contactController');

const submit = async (body) => {
  let status = null; let error = null;
  const res = { status(c) { status = c; return this; }, json() { return this; } };
  submitSuccessStory({ body }, res, (e) => { error = e; });
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  return { status, error };
};

describe('success story contact screening', () => {
  beforeEach(() => mockCreate.mockClear());

  it('accepts a story with no contact details', async () => {
    const { status, error } = await submit({ coupleNames: 'Ravi & Simran', quote: 'We met in 2024 at Sector 17 and married on 12/02/2026.', location: 'Mohali' });
    expect(error).toBeNull();
    expect(status).toBe(201);
    expect(mockCreate).toHaveBeenCalled();
  });

  it.each([
    ['phone in the story', { coupleNames: 'Ravi & Simran', quote: 'Call us on 98765 43210 for tips' }],
    ['email in the names', { coupleNames: 'ravi@gmail.com & Simran', quote: 'Lovely story' }],
    ['handle in the location', { coupleNames: 'Ravi & Simran', quote: 'Lovely story', location: 'insta @ravisimran' }],
  ])('refuses %s', async (_label, body) => {
    const { error } = await submit(body);
    expect(error).toBeTruthy();
    expect(error.statusCode).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
