const { validationResult } = require('express-validator');
const { passwordProblem, passwordField } = require('../../utils/passwordPolicy');

const run = async (field, value, opts) => {
  const chain = passwordField(field, opts);
  const req = { body: { [field]: value } };
  await chain.run(req);
  return validationResult(req).array().map((e) => e.msg);
};

describe('shared password policy (AUTH-11)', () => {
  it.each([
    'Hello#1234', '#Hello1234a!', '_Abcdef1!x', 'Abcdefg1!', 'Passw0rd#', 'Passw0rd!#', 'Aa1-aaaa', 'Aa1_aaaa',
  ])('accepts %p', (pw) => { expect(passwordProblem(pw)).toBeNull(); });

  it.each([
    ['', /required/i], ['Aa1!aaa', /at least 8/], ['alllower1!', /uppercase/], ['ALLUPPER1!', /lowercase/],
    ['NoDigits!!', /number/], ['NoSpecial123', /special/], ['Aa1 aaaaa', /special/],
  ])('rejects %p', (pw, msg) => { expect(passwordProblem(pw)).toMatch(msg); });

  it('caps length at the column limit', () => {
    expect(passwordProblem(`Aa1!${'x'.repeat(97)}`)).toMatch(/at most 100/);
    expect(passwordProblem(`Aa1!${'x'.repeat(96)}`)).toBeNull();
  });

  it('staff minimum can be raised', () => {
    expect(passwordProblem('Aa1!aaaa', { minLength: 12 })).toMatch(/at least 12/);
  });

  it('express-validator chain: same verdict in every flow, no non-string crash', async () => {
    expect(await run('newPassword', 'Hello#1234')).toEqual([]);
    expect(await run('password', 'weak')).toHaveLength(1);
    expect(await run('password', { $ne: 1 })).toHaveLength(1);
    expect(await run('password', undefined)).toHaveLength(1);
  });
});
