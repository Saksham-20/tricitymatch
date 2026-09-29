/**
 * P1-4 private media. Selfies, voice notes and video intros are uploaded as
 * Cloudinary `authenticated` assets and only ever leave the server as
 * short-lived download URLs.
 */

jest.mock('../../config/env', () => {
  const actual = jest.requireActual('../../config/env');
  return {
    ...actual,
    cloudinary: {
      ...actual.cloudinary,
      cloudName: 'demo', apiKey: '123456789012345', apiSecret: 'test-secret-value',
      folder: 'tm', isConfigured: () => true,
    },
  };
});

const fs = require('fs');
const path = require('path');
const { signMediaUrl, withSignedMedia, TTL } = require('../../utils/privateMedia');

const AUTH_VIDEO = 'https://res.cloudinary.com/demo/video/authenticated/s--AbCdEf12--/v1790680980/tm/voice-messages/abc123.m4a';
const AUTH_IMAGE = 'https://res.cloudinary.com/demo/image/authenticated/s--ZzZz1234--/v1790680980/tm/verification-docs/selfie1.jpg';
const PUBLIC_IMAGE = 'https://res.cloudinary.com/demo/image/upload/v1/tm/gallery/photo.jpg';

const query = (url) => Object.fromEntries(new URL(url).searchParams);

describe('signMediaUrl', () => {
  it('exchanges an authenticated asset for an expiring download URL', () => {
    const now = Date.UTC(2026, 8, 29, 12, 0, 0);
    const url = signMediaUrl(AUTH_VIDEO, 600, now);
    const u = new URL(url);
    expect(u.hostname).toBe('api.cloudinary.com');
    expect(u.pathname).toBe('/v1_1/demo/video/download');
    const q = query(url);
    expect(q.public_id).toBe('tm/voice-messages/abc123');
    expect(q.format).toBe('m4a');
    expect(q.type).toBe('authenticated');
    expect(Number(q.expires_at)).toBe(Math.floor(now / 1000) + 600);
    expect(q.signature).toMatch(/^[0-9a-f]{40}$/);
    // The permanent signed delivery path is not in what the client receives.
    expect(url).not.toContain('s--AbCdEf12--');
  });

  it('uses the image resource type for selfies and expires quickly', () => {
    const now = Date.now();
    const url = signMediaUrl(AUTH_IMAGE, TTL.selfie, now);
    expect(new URL(url).pathname).toBe('/v1_1/demo/image/download');
    expect(Number(query(url).expires_at)).toBe(Math.floor(now / 1000) + 600);
    expect(TTL.selfie).toBeLessThanOrEqual(15 * 60);
  });

  it('passes legacy public, local and empty values through unchanged', () => {
    expect(signMediaUrl(PUBLIC_IMAGE)).toBe(PUBLIC_IMAGE);
    expect(signMediaUrl('/uploads/voice-1.m4a')).toBe('/uploads/voice-1.m4a');
    expect(signMediaUrl(null)).toBeNull();
    expect(signMediaUrl('')).toBe('');
    expect(signMediaUrl('https://example.com/a.mp3')).toBe('https://example.com/a.mp3');
  });

  it('two signings of the same asset differ once the clock moves', () => {
    const a = signMediaUrl(AUTH_VIDEO, 600, 1_000_000);
    const b = signMediaUrl(AUTH_VIDEO, 600, 1_005_000);
    expect(a).not.toBe(b);
  });
});

describe('withSignedMedia', () => {
  it('signs only the named fields and does not mutate the input', () => {
    const src = { voiceIntroUrl: AUTH_VIDEO, profilePhoto: PUBLIC_IMAGE, city: 'Mohali' };
    const out = withSignedMedia(src, { voiceIntroUrl: 60 });
    expect(out.voiceIntroUrl).toContain('/download?');
    expect(out.profilePhoto).toBe(PUBLIC_IMAGE);
    expect(out.city).toBe('Mohali');
    expect(src.voiceIntroUrl).toBe(AUTH_VIDEO);
  });
});

describe('model serialisation', () => {
  it('Message, Profile and Verification sign on toJSON but keep the stored attribute', () => {
    const { Message, Profile, Verification } = require('../../models');
    const m = Message.build({ senderId: 'a', receiverId: 'b', content: '', messageType: 'voice', mediaUrl: AUTH_VIDEO });
    expect(m.toJSON().mediaUrl).toContain('/video/download?');
    expect(m.mediaUrl).toBe(AUTH_VIDEO);

    const p = Profile.build({ userId: 'u', voiceIntroUrl: AUTH_VIDEO, videoIntroUrl: AUTH_VIDEO });
    const pj = p.toJSON();
    expect(pj.voiceIntroUrl).toContain('/download?');
    expect(pj.videoIntroUrl).toContain('/download?');
    expect(p.voiceIntroUrl).toBe(AUTH_VIDEO);

    const v = Verification.build({ userId: 'u', selfiePhoto: AUTH_IMAGE });
    expect(v.toJSON().selfiePhoto).toContain('/image/download?');
    expect(v.selfiePhoto).toBe(AUTH_IMAGE);
  });
});

describe('uploads', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../middlewares/upload.js'), 'utf8');
  it.each(['voice-intros', 'voice-messages', 'video-intros'])('%s are stored as authenticated assets', (folder) => {
    const block = src.split(`/${folder}\``)[1].slice(0, 200);
    expect(block).toMatch(/type: 'authenticated'/);
  });
  it('verification documents (selfies) are stored as authenticated assets', () => {
    expect(src).toMatch(/formats: \['jpg', 'jpeg', 'png', 'webp'\], type: 'authenticated'/);
  });
  it('the selfie endpoint accepts one image field and nothing else (no PDFs, no ID documents)', () => {
    expect(src).toMatch(/\.fields\(\[\{ name: 'selfiePhoto', maxCount: 1 \}\]\)/);
    expect(src).not.toMatch(/documentFront|documentBack/);
    expect(src).not.toMatch(/'pdf'\]?, type: 'authenticated'/);
  });
});

describe('member data export', () => {
  it('signs private media instead of exporting the permanent stored URL', async () => {
    jest.resetModules();
    const rowsByModel = {
      Message: [{ id: 'm1', mediaUrl: AUTH_VIDEO }],
      Verification: [{ id: 'v1', selfiePhoto: AUTH_IMAGE }],
    };
    const mk = (name) => ({ findAll: async () => rowsByModel[name] || [], findOne: async () => ({ voiceIntroUrl: AUTH_VIDEO, userId: 'u' }), findByPk: async () => ({ id: 'u', email: 'a@b.co', get() { return this; } }) });
    jest.doMock('../../models', () => {
      const names = ['User','Profile','Match','Message','Notification','Subscription','UnlockPurchase','ContactUnlock','ProfileView','Block','Report','Verification','GroupMember','GroupMessage','GuardianLink','AstrologerBooking','ContactMessage','AnalyticsEvent','RefreshToken'];
      return Object.fromEntries(names.map((n) => [n, mk(n)]));
    });
    const { buildMemberExport } = require('../../utils/dataExport');
    const out = await buildMemberExport('u');
    expect(out.messages[0].mediaUrl).toContain('/download?');
    expect(out.verification[0].selfiePhoto).toContain('/download?');
    expect(out.profile.voiceIntroUrl).toContain('/download?');
  });
});
