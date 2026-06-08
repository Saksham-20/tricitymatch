/**
 * Background Check Service — APP-060
 * Adapters for AuthBridge and Signzy India KYC/BGV APIs.
 * Returns a normalized result regardless of provider.
 *
 * Normalized submit response:
 *   { providerRef: string, status: 'submitted' }
 *
 * Normalized webhook payload (after verifyWebhook):
 *   { providerRef: string, status: 'passed' | 'failed', raw: object }
 */

const crypto = require('crypto');
const https = require('https');
const config = require('../config/env');
const { log } = require('../middlewares/logger');

// ─── Shared HTTP helper ──────────────────────────────────────────────────────

function httpsPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const data = JSON.stringify(body);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + (parsed.search || ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers,
      },
    };
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          const parsed2 = JSON.parse(raw);
          if (res.statusCode >= 400) {
            const err = new Error(`HTTP ${res.statusCode}: ${parsed2.message || raw}`);
            err.statusCode = res.statusCode;
            err.body = parsed2;
            return reject(err);
          }
          resolve(parsed2);
        } catch {
          reject(new Error(`Non-JSON response (${res.statusCode}): ${raw.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(new Error('Request timed out')); });
    req.write(data);
    req.end();
  });
}

// ─── AuthBridge adapter ──────────────────────────────────────────────────────
// Docs: https://authbridge.com/docs (criminal + court record + marital check)

async function authBridgeSubmit({ userId, name, phone, aadhaarLast4 }) {
  const baseUrl = config.bgCheck.authBridgeBaseUrl;
  const payload = {
    reference_id: `TCM_${userId}_${Date.now()}`,
    candidate: {
      name,
      phone,
      aadhaar_last4: aadhaarLast4 || undefined,
    },
    checks: ['criminal', 'court', 'marital_status'],
    webhook_url: `${config.server.frontendUrl.replace('//', '//api.')}/api/v1/verification/bg-check/webhook`,
  };

  const response = await httpsPost(
    `${baseUrl}/background-check/initiate`,
    payload,
    {
      Authorization: `Bearer ${config.bgCheck.apiKey}`,
      'X-Client-Secret': config.bgCheck.apiSecret,
    }
  );

  log.info('AuthBridge BGC submitted', { userId, reportId: response.report_id });
  return { providerRef: response.report_id, status: 'submitted' };
}

function authBridgeVerifyWebhook(rawBody, signature) {
  const expected = crypto
    .createHmac('sha256', config.bgCheck.webhookSecret)
    .update(rawBody)
    .digest('hex');
  const safe = crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(signature.replace('sha256=', ''), 'hex')
  );
  return safe;
}

function authBridgeParseWebhook(body) {
  // AuthBridge sends: { report_id, status: 'completed'|'failed', result: 'clear'|'consider' }
  const passed = body.status === 'completed' && body.result === 'clear';
  return {
    providerRef: body.report_id,
    status: passed ? 'passed' : 'failed',
    raw: body,
  };
}

// ─── Signzy adapter ──────────────────────────────────────────────────────────
// Docs: https://signzy.com/docs (India-focused, supports court + aadhaar + marital)

async function signzySubmit({ userId, name, phone }) {
  const baseUrl = config.bgCheck.signzyBaseUrl;
  const patronId = config.bgCheck.signzyPatronId;

  // Step 1: get task token
  const taskResp = await httpsPost(
    `${baseUrl}/patrons/${patronId}/tasks`,
    {
      service: 'bgv',
      essentials: {
        uniqueId: `TCM_${userId}_${Date.now()}`,
        name,
        phone,
        callbackUrl: `${config.server.frontendUrl.replace('//', '//api.')}/api/v1/verification/bg-check/webhook`,
      },
    },
    {
      Authorization: config.bgCheck.apiKey,
    }
  );

  const taskId = taskResp.result?.taskId || taskResp.taskId;
  if (!taskId) throw new Error('Signzy did not return a taskId');

  log.info('Signzy BGC submitted', { userId, taskId });
  return { providerRef: taskId, status: 'submitted' };
}

function signzyVerifyWebhook(rawBody, signature) {
  const expected = crypto
    .createHmac('sha256', config.bgCheck.webhookSecret)
    .update(rawBody)
    .digest('hex');
  const safe = crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(signature, 'hex')
  );
  return safe;
}

function signzyParseWebhook(body) {
  // Signzy sends: { taskId, status: 'completed'|'failed', result: { isClear: boolean } }
  const passed = body.status === 'completed' && body.result?.isClear === true;
  return {
    providerRef: body.taskId,
    status: passed ? 'passed' : 'failed',
    raw: body,
  };
}

// ─── Dev/stub adapter ────────────────────────────────────────────────────────

function devSubmit({ userId }) {
  log.info('[BGC-DEV] stub submit', { userId });
  return Promise.resolve({ providerRef: `DEV_${userId}_${Date.now()}`, status: 'submitted' });
}

function devVerifyWebhook() { return true; }

function devParseWebhook(body) {
  return { providerRef: body.providerRef || 'DEV', status: 'passed', raw: body };
}

// ─── Public API ──────────────────────────────────────────────────────────────

function getAdapter() {
  switch (config.bgCheck.provider) {
    case 'authbridge': return { submit: authBridgeSubmit, verifyWebhook: authBridgeVerifyWebhook, parseWebhook: authBridgeParseWebhook };
    case 'signzy':     return { submit: signzySubmit,     verifyWebhook: signzyVerifyWebhook,     parseWebhook: signzyParseWebhook };
    default:           return { submit: devSubmit,        verifyWebhook: devVerifyWebhook,        parseWebhook: devParseWebhook };
  }
}

/**
 * Submit a background check to the configured provider.
 * @param {{ userId: number, name: string, phone: string, aadhaarLast4?: string }} candidate
 * @returns {Promise<{ providerRef: string, status: 'submitted' }>}
 */
async function submitBgCheck(candidate) {
  return getAdapter().submit(candidate);
}

/**
 * Verify incoming webhook signature.
 * @param {Buffer|string} rawBody  Raw request body bytes
 * @param {string} signature       Header value (X-Signature or X-Authbridge-Signature)
 * @returns {boolean}
 */
function verifyBgCheckWebhook(rawBody, signature) {
  if (!config.bgCheck.webhookSecret) {
    log.warn('[BGC] No BG_CHECK_WEBHOOK_SECRET set — skipping webhook sig verification (dev only)');
    return true;
  }
  return getAdapter().verifyWebhook(rawBody, signature);
}

/**
 * Parse a verified webhook body into a normalized result.
 * @param {object} body
 * @returns {{ providerRef: string, status: 'passed'|'failed', raw: object }}
 */
function parseBgCheckWebhook(body) {
  return getAdapter().parseWebhook(body);
}

module.exports = { submitBgCheck, verifyBgCheckWebhook, parseBgCheckWebhook };
