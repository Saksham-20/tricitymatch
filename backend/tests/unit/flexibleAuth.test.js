/**
 * Flexible Auth Validators — email-OR-phone login/signup + change-email OTP
 */
const { validationResult } = require('express-validator');
const { mockRequest } = require('../helpers/testHelper');
const validators = require('../../validators');

const run = async (validationArray, body) => {
  const req = mockRequest({ body });
  for (const v of validationArray) await v.run(req);
  return validationResult(req);
};

describe('Flexible auth validators', () => {
  describe('loginValidation', () => {
    it('passes with an email identifier', async () => {
      const r = await run(validators.loginValidation, { identifier: 'a@b.com', password: 'x' });
      expect(r.isEmpty()).toBe(true);
    });
    it('passes with a phone identifier', async () => {
      const r = await run(validators.loginValidation, { identifier: '9876543210', password: 'x' });
      expect(r.isEmpty()).toBe(true);
    });
    it('still accepts the legacy `email` field', async () => {
      const r = await run(validators.loginValidation, { email: 'a@b.com', password: 'x' });
      expect(r.isEmpty()).toBe(true);
    });
    it('fails with no identifier', async () => {
      const r = await run(validators.loginValidation, { password: 'x' });
      expect(r.isEmpty()).toBe(false);
    });
    it('fails with no password', async () => {
      const r = await run(validators.loginValidation, { identifier: 'a@b.com' });
      expect(r.isEmpty()).toBe(false);
    });
  });

  describe('signupValidation (email OR phone)', () => {
    const base = { password: 'StrongPass123!', firstName: 'John', lastName: 'Doe' };
    it('passes with email only', async () => {
      const r = await run(validators.signupValidation, { ...base, email: 'a@b.com' });
      expect(r.isEmpty()).toBe(true);
    });
    it('passes with phone only', async () => {
      const r = await run(validators.signupValidation, { ...base, phone: '9876543210' });
      expect(r.isEmpty()).toBe(true);
    });
    it('fails with neither email nor phone', async () => {
      const r = await run(validators.signupValidation, { ...base });
      expect(r.isEmpty()).toBe(false);
    });
    it('rejects a non-Indian phone', async () => {
      const r = await run(validators.signupValidation, { ...base, phone: '12345' });
      expect(r.isEmpty()).toBe(false);
    });
  });

  describe('changeEmailVerifyValidation', () => {
    it('passes with a 6-digit code + valid email', async () => {
      const r = await run(validators.changeEmailVerifyValidation, { newEmail: 'new@b.com', code: '123456' });
      expect(r.isEmpty()).toBe(true);
    });
    it('fails with a non-numeric / wrong-length code', async () => {
      const r = await run(validators.changeEmailVerifyValidation, { newEmail: 'new@b.com', code: '12ab' });
      expect(r.isEmpty()).toBe(false);
    });
    it('fails with an invalid new email', async () => {
      const r = await run(validators.changeEmailVerifyValidation, { newEmail: 'nope', code: '123456' });
      expect(r.isEmpty()).toBe(false);
    });
  });
});
