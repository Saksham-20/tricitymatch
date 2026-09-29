/**
 * Public health endpoints say up/down and nothing else (audit P1-16, F-26).
 */

const request = require('supertest');
const express = require('express');
const { describeDb } = require('../../helpers/db');

describeDb('public health endpoints', (t) => {
  const app = () => {
    const a = express();
    a.use('/monitoring', require('../../../routes/monitoring'));
    return a;
  };

  t('readiness reports status only: no driver errors, no pool sizes', async () => {
    const res = await request(app()).get('/monitoring/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.checks.database).toEqual({ status: expect.any(String) });
    expect(res.body.checks.redis).toEqual({ status: expect.any(String) });
    const dump = JSON.stringify(res.body);
    expect(dump).not.toMatch(/pool|responseTime|error|message/i);
  });

  t('liveness carries no pid or uptime', async () => {
    const res = await request(app()).get('/monitoring/health');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['status', 'timestamp']);
  });

  t('the detailed report still requires authentication', async () => {
    const res = await request(app()).get('/monitoring/health/full');
    expect([401, 403]).toContain(res.status);
  });
});
