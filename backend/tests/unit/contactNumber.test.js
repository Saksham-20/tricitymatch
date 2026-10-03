/**
 * Contact number verification.
 *
 * The number other members call after an unlock must be one the owner proved
 * they control. The DB is the source of truth: a number already verified for
 * the account saves with no OTP; any other number needs a code; a number that
 * belongs to a different account is refused before an SMS is sent.
 */

jest.mock('../../config/env', () => ({
  features: {},
  founding: { isOpen: jest.fn(() => false) },
  auth: { jwtSecret: 'test', jwtExpiry: '15m', refreshTokenExpiry: '7d' },
  server: { frontendUrl: 'http://localhost:3000' },
  isProduction: false,
  isDevelopment: true,
  google: {},
  otp: {},
}));
jest.mock('../../models', () => ({
  User: { findByPk: jest.fn(), findOne: jest.fn(), update: jest.fn() },
  Profile: {}, RefreshToken: {}, ReferralCode: {}, MarketingLead: {},
}));
jest.mock('../../utils/entitlements', () => ({ getActiveSubscription: jest.fn() }));
jest.mock('../../utils/email', () => ({
  sendWelcomeEmail: jest.fn(), sendPasswordResetEmail: jest.fn(), sendEmail: jest.fn(),
  sendOtpEmail: jest.fn(), sendSecurityAlert: jest.fn(),
}));
jest.mock('../../utils/smsService', () => ({ sendOtp: jest.fn(), verifyOtp: jest.fn() }));
jest.mock('../../utils/trackEvent', () => ({ trackEvent: jest.fn() }));
jest.mock('../../utils/foundingGrant', () => ({ grantFoundingIfOpen: jest.fn() }));
jest.mock('../../middlewares/security', () => ({ recordFailedLogin: jest.fn(), clearLoginAttempts: jest.fn() }));
jest.mock('../../middlewares/logger', () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  logSecurityEvent: jest.fn(), logAudit: jest.fn(),
}));

const { User } = require('../../models');
const smsService = require('../../utils/smsService');
const { requestContactNumber, verifyContactNumber } = require('../../controllers/authController');

const call = async (handler, body) => {
  const res = { json: jest.fn() };
  const next = jest.fn();
  handler({ user: { id: 'u1' }, body }, res, next);
  await new Promise((resolve) => setImmediate(resolve));
  return { res, error: next.mock.calls[0]?.[0] };
};

beforeEach(() => {
  jest.clearAllMocks();
  User.findOne.mockResolvedValue(null);
  smsService.sendOtp.mockResolvedValue({ success: true });
  smsService.verifyOtp.mockResolvedValue({ success: true });
});

describe('requestContactNumber', () => {
  test('a number already verified for the account skips the OTP entirely', async () => {
    User.findByPk.mockResolvedValue({ id: 'u1', phone: '9876543210', phoneVerified: true });
    const { res } = await call(requestContactNumber, { phone: '+91 98765 43210' });
    expect(res.json.mock.calls[0][0]).toMatchObject({ alreadyVerified: true, phone: '9876543210' });
    expect(smsService.sendOtp).not.toHaveBeenCalled();
  });

  test('an unverified stored number still needs an OTP', async () => {
    User.findByPk.mockResolvedValue({ id: 'u1', phone: '9876543210', phoneVerified: false });
    const { res } = await call(requestContactNumber, { phone: '9876543210' });
    expect(smsService.sendOtp).toHaveBeenCalledWith('9876543210');
    expect(res.json.mock.calls[0][0].alreadyVerified).toBe(false);
  });

  test('a number owned by another account is refused before any SMS', async () => {
    User.findByPk.mockResolvedValue({ id: 'u1', phone: null, phoneVerified: false });
    User.findOne.mockResolvedValue({ id: 'someone-else' });
    const { error } = await call(requestContactNumber, { phone: '9123456789' });
    expect(error.statusCode).toBe(409);
    expect(smsService.sendOtp).not.toHaveBeenCalled();
  });

  test('rejects a number that is not a valid Indian mobile', async () => {
    const { error } = await call(requestContactNumber, { phone: '1234567890' });
    expect(error.statusCode).toBe(400);
  });
});

describe('verifyContactNumber', () => {
  test('a correct code saves the number as verified', async () => {
    User.findByPk.mockResolvedValue({ id: 'u1', phone: null, phoneVerified: false });
    const { res } = await call(verifyContactNumber, { phone: '9123456789', code: '1234' });
    expect(smsService.verifyOtp).toHaveBeenCalledWith('9123456789', '1234');
    expect(User.update).toHaveBeenCalledWith({ phone: '9123456789', phoneVerified: true, contactPhone: null }, { where: { id: 'u1' } });
    expect(res.json.mock.calls[0][0].phoneVerified).toBe(true);
  });

  test('a wrong code saves nothing', async () => {
    User.findByPk.mockResolvedValue({ id: 'u1', phone: null, phoneVerified: false });
    smsService.verifyOtp.mockRejectedValue(Object.assign(new Error('Invalid OTP'), { statusCode: 400 }));
    const { error } = await call(verifyContactNumber, { phone: '9123456789', code: '0000' });
    expect(error).toBeDefined();
    expect(User.update).not.toHaveBeenCalled();
  });

  test('re-confirming the already verified number needs no code and writes nothing', async () => {
    User.findByPk.mockResolvedValue({ id: 'u1', phone: '9876543210', phoneVerified: true });
    const { res } = await call(verifyContactNumber, { phone: '9876543210' });
    expect(res.json.mock.calls[0][0].phoneVerified).toBe(true);
    expect(smsService.verifyOtp).not.toHaveBeenCalled();
    expect(User.update).not.toHaveBeenCalled();
  });

  test('a new number without a code is refused', async () => {
    User.findByPk.mockResolvedValue({ id: 'u1', phone: null, phoneVerified: false });
    const { error } = await call(verifyContactNumber, { phone: '9123456789' });
    expect(error.statusCode).toBe(400);
  });
});

describe('a contact number that is not the login number', () => {
  const loginUser = { id: 'u1', phone: '9876543210', phoneVerified: true, contactPhone: null };

  test('a different number is stored as contactPhone and the login phone is untouched', async () => {
    User.findByPk.mockResolvedValue({ ...loginUser });
    const { res } = await call(verifyContactNumber, { phone: '9123456789', code: '1234' });
    expect(User.update).toHaveBeenCalledWith({ contactPhone: '9123456789' }, { where: { id: 'u1' } });
    expect(res.json.mock.calls[0][0]).toMatchObject({ phone: '9123456789', isLoginNumber: false, contactPhone: '9123456789' });
  });

  test('a number that is on another account can be the contact number (siblings share a parent number)', async () => {
    User.findByPk.mockResolvedValue({ ...loginUser });
    User.findOne.mockResolvedValue({ id: 'sibling-account' });
    const { error } = await call(requestContactNumber, { phone: '9123456789' });
    expect(error).toBeUndefined();
    expect(smsService.sendOtp).toHaveBeenCalledWith('9123456789');
  });

  test('it still needs an OTP: nothing is stored without proving the number', async () => {
    User.findByPk.mockResolvedValue({ ...loginUser });
    smsService.verifyOtp.mockRejectedValue(Object.assign(new Error('Invalid OTP'), { statusCode: 400 }));
    const { error } = await call(verifyContactNumber, { phone: '9123456789', code: '0000' });
    expect(error).toBeDefined();
    expect(User.update).not.toHaveBeenCalled();
  });

  test('the saved contact number re-confirms with no code', async () => {
    User.findByPk.mockResolvedValue({ ...loginUser, contactPhone: '9123456789' });
    const { res } = await call(verifyContactNumber, { phone: '9123456789' });
    expect(smsService.verifyOtp).not.toHaveBeenCalled();
    expect(User.update).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0]).toMatchObject({ isLoginNumber: false, contactPhone: '9123456789' });
  });

  test('picking the login number again clears the separate contact number', async () => {
    User.findByPk.mockResolvedValue({ ...loginUser, contactPhone: '9123456789' });
    const { res } = await call(verifyContactNumber, { phone: '9876543210' });
    expect(User.update).toHaveBeenCalledWith({ contactPhone: null }, { where: { id: 'u1' } });
    expect(res.json.mock.calls[0][0]).toMatchObject({ isLoginNumber: true, contactPhone: null });
  });

  test('a member with no verified login number: the number becomes the login number and must be unique', async () => {
    User.findByPk.mockResolvedValue({ id: 'u1', phone: null, phoneVerified: false, contactPhone: null });
    User.findOne.mockResolvedValue({ id: 'someone-else' });
    const { error } = await call(requestContactNumber, { phone: '9123456789' });
    expect(error.statusCode).toBe(409);
  });
});
