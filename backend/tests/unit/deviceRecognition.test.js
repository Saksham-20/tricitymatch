const { describeDevice, maskIp } = require('../../utils/deviceRecognition');

const UA = {
  chromeMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  chromeMacNewer: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  safariMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  edgeWin: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
  firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  safariIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  androidApp: 'okhttp/4.12.0',
  iosApp: 'TricityMatch/1 CFNetwork/1494.0.7 Darwin/23.4.0',
};

describe('describeDevice', () => {
  it('reads browser and system', () => {
    expect(describeDevice(UA.chromeMac).label).toBe('Chrome on macOS');
    expect(describeDevice(UA.safariMac).label).toBe('Safari on macOS');
    expect(describeDevice(UA.edgeWin).label).toBe('Edge on Windows');
    expect(describeDevice(UA.firefoxLinux).label).toBe('Firefox on Linux');
    expect(describeDevice(UA.chromeAndroid).label).toBe('Chrome on Android');
    expect(describeDevice(UA.safariIphone).label).toBe('Safari on iOS');
  });

  it('recognises the mobile apps', () => {
    expect(describeDevice(UA.androidApp).label).toContain('TricityMatch app');
    expect(describeDevice(UA.iosApp).label).toBe('TricityMatch app on iOS');
  });

  it('a browser update is the same device; a different browser is not', () => {
    expect(describeDevice(UA.chromeMac).key).toBe(describeDevice(UA.chromeMacNewer).key);
    expect(describeDevice(UA.chromeMac).key).not.toBe(describeDevice(UA.safariMac).key);
  });

  it('handles missing agents', () => {
    expect(describeDevice(undefined).label).toBe('an unknown device');
    expect(describeDevice('').key).toBe('unknown|unknown');
  });
});

describe('maskIp', () => {
  it('keeps enough to recognise, not to locate', () => {
    expect(maskIp('203.0.113.42')).toBe('203.0.x.x');
    expect(maskIp('::ffff:203.0.113.42')).toBe('203.0.x.x');
    expect(maskIp('2001:db8:85a3::8a2e:370:7334')).toBe('2001:db8::');
    expect(maskIp('')).toBeNull();
    expect(maskIp('garbage')).toBeNull();
  });
});
