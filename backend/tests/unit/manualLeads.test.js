'use strict';

jest.mock('../../models', () => ({
  MarketingLead: { count: jest.fn(), findOne: jest.fn(), create: jest.fn(), findAll: jest.fn() },
  User: {},
}));
jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const { MarketingLead } = require('../../models');
const { createManualLead, findManualLeadForSignup, MANUAL_LEADS_CAP } = require('../../utils/manualLeads');

const REP = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  jest.clearAllMocks();
  MarketingLead.count.mockResolvedValue(0);
  MarketingLead.findOne.mockResolvedValue(null);
  MarketingLead.create.mockImplementation(async (row) => ({ id: 'lead-1', ...row }));
});

describe('createManualLead', () => {
  it('stores the phone in canonical 91XXXXXXXXXX form and the email canonicalised', async () => {
    const lead = await createManualLead({
      marketingUserId: REP, name: '  Priya Sharma ', phone: '098765 43210', email: 'Priya.S@Gmail.com ', city: 'Mohali',
    });
    expect(lead.phone).toBe('919876543210');
    expect(lead.email).toBe('priya.s@gmail.com');
    expect(lead.name).toBe('Priya Sharma');
    expect(MarketingLead.create).toHaveBeenCalledWith(expect.objectContaining({
      source: 'manual', status: 'new', assignedToMarketingUserId: REP, city: 'Mohali',
    }));
  });

  it('rejects a number that is not an Indian mobile', async () => {
    await expect(createManualLead({ marketingUserId: REP, name: 'A B', phone: '12345' }))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(MarketingLead.create).not.toHaveBeenCalled();
  });

  it('rejects a duplicate within the same partner list only', async () => {
    MarketingLead.findOne.mockResolvedValue({ id: 'existing' });
    await expect(createManualLead({ marketingUserId: REP, name: 'A B', phone: '9876543210' }))
      .rejects.toMatchObject({ statusCode: 409 });
    // The duplicate check is scoped to the partner, never global.
    expect(MarketingLead.findOne.mock.calls[0][0].where.assignedToMarketingUserId).toBe(REP);
  });

  it('refuses beyond the cap', async () => {
    MarketingLead.count.mockResolvedValue(MANUAL_LEADS_CAP);
    await expect(createManualLead({ marketingUserId: REP, name: 'A B', phone: '9876543210' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('findManualLeadForSignup', () => {
  it('returns null with nothing to match on', async () => {
    expect(await findManualLeadForSignup({ phone: null, email: null })).toBeNull();
    expect(MarketingLead.findAll).not.toHaveBeenCalled();
  });

  it('matches on the canonical phone, unconverted and recent, earliest first', async () => {
    MarketingLead.findAll.mockResolvedValue([{ id: 'lead-1', assignedToMarketingUserId: REP }]);
    const lead = await findManualLeadForSignup({ phone: '9876543210', email: null });
    expect(lead.id).toBe('lead-1');
    const q = MarketingLead.findAll.mock.calls[0][0];
    expect(q.where.source).toBe('manual');
    expect(q.where.convertedUserId).toBeNull();
    expect(q.order).toEqual([['createdAt', 'ASC']]);
    expect(q.limit).toBe(1);
    expect(q.include[0].where).toEqual({ status: 'active' });
  });
});
