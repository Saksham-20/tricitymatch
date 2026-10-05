const { validate, maskedView, changedRecently, PayoutDetailsError, __encrypt, __decrypt } = require('../../utils/payoutDetails');
const { computeBalance } = require('../../utils/marketingPayouts');

describe('payout details validation', () => {
  const pan = 'ABCDE1234F';
  it('accepts a UPI id and a bank account, normalising case and spaces', () => {
    expect(validate({ method: 'UPI', upiId: ' Priya@OkHDFC ', pan: 'abcde1234f' }))
      .toEqual({ method: 'upi', pan, upiId: 'priya@okhdfc' });
    expect(validate({ method: 'bank', accountHolder: 'P S', accountNumber: '1234 5678 9012', ifsc: 'hdfc0001234', pan }))
      .toMatchObject({ method: 'bank', accountNumber: '123456789012', ifsc: 'HDFC0001234' });
  });

  it.each([
    [{ method: 'wire', pan }],
    [{ method: 'upi', upiId: 'nope', pan }],
    [{ method: 'upi', upiId: 'a@b', pan }],
    [{ method: 'upi', upiId: 'priya@okhdfc', pan: 'ABCDE12345' }],
    [{ method: 'bank', accountHolder: 'P', accountNumber: '123456789', ifsc: 'HDFC0001234', pan }],
    [{ method: 'bank', accountHolder: 'Priya', accountNumber: '12345678', ifsc: 'HDFC0001234', pan }],
    [{ method: 'bank', accountHolder: 'Priya', accountNumber: '123456789', ifsc: 'HDFC1001234', pan }],
  ])('rejects %j', (input) => {
    expect(() => validate(input)).toThrow(PayoutDetailsError);
  });
});

describe('masking and encryption', () => {
  it('masks everything sensitive', () => {
    const v = maskedView({ method: 'bank', accountHolder: 'Priya', accountNumber: '123456789012', ifsc: 'HDFC0001234', pan: 'ABCDE1234F' });
    expect(v.accountNumber).toBe('••••••••9012');
    expect(v.pan).toBe('AB••••••4F');
    expect(JSON.stringify(v)).not.toMatch(/123456789012|ABCDE1234F/);
    expect(maskedView({ method: 'upi', upiId: 'priya@okhdfc' }).upiId).toBe('pr•••@okhdfc');
  });

  it('round-trips, never stores plaintext, and a tampered blob does not decrypt', () => {
    const blob = __encrypt({ pan: 'ABCDE1234F' });
    expect(Buffer.from(blob, 'base64').toString('utf8')).not.toContain('ABCDE1234F');
    expect(__decrypt(blob)).toEqual({ pan: 'ABCDE1234F' });
    const raw = Buffer.from(blob, 'base64'); raw[raw.length - 1] ^= 1;
    expect(() => __decrypt(raw.toString('base64'))).toThrow();
    expect(__encrypt({ a: 1 })).not.toBe(__encrypt({ a: 1 })); // fresh IV every time
  });

  it('flags details changed in the last 48 hours', () => {
    const now = Date.now();
    expect(changedRecently(new Date(now - 3600 * 1000), now)).toBe(true);
    expect(changedRecently(new Date(now - 49 * 3600 * 1000), now)).toBe(false);
    expect(changedRecently(null, now)).toBe(false);
  });
});

describe('computeBalance with a refund window', () => {
  it('payable is the cleared part less paid and queued; the rest is in hold', () => {
    expect(computeBalance(300, [], 100)).toMatchObject({ outstanding: 300, payable: 100, inHold: 200 });
    expect(computeBalance(300, [{ amount: 60, status: 'pending' }], 100)).toMatchObject({ payable: 40, inHold: 200 });
    expect(computeBalance(300, [{ amount: 150, status: 'paid' }], 100)).toMatchObject({ payable: 0, outstanding: 150, inHold: 150 });
  });
  it('without a cleared figure everything counts as payable', () => {
    expect(computeBalance(200, [])).toMatchObject({ payable: 200, inHold: 0 });
  });
  it('payable never exceeds outstanding', () => {
    expect(computeBalance(100, [], 900)).toMatchObject({ payable: 100 });
  });
});
