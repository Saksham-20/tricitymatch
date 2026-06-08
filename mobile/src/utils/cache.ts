import type { MMKV } from 'react-native-mmkv';

// In-memory fallback for when MMKV native module unavailable (Expo Go / dev)
class MemoryStorage {
  private store: Map<string, string> = new Map();
  getString(key: string): string | undefined { return this.store.get(key); }
  set(key: string, value: string | boolean | number): void { this.store.set(key, String(value)); }
  getBoolean(key: string): boolean | undefined {
    const v = this.store.get(key);
    return v === undefined ? undefined : v === 'true';
  }
  getNumber(key: string): number | undefined {
    const v = this.store.get(key);
    return v === undefined ? undefined : Number(v);
  }
  delete(key: string): void { this.store.delete(key); }
  clearAll(): void { this.store.clear(); }
}

function createStorage(): MMKV {
  try {
    const { MMKV: MMKVClass } = require('react-native-mmkv') as typeof import('react-native-mmkv');
    return new MMKVClass({ id: 'tricityshadi' });
  } catch {
    return new MemoryStorage() as unknown as MMKV;
  }
}

export const storage: MMKV = createStorage();

export const cache = {
  getString: (key: string): string | undefined => storage.getString(key),
  setString: (key: string, value: string): void => storage.set(key, value),
  getBoolean: (key: string): boolean | undefined => storage.getBoolean(key),
  setBoolean: (key: string, value: boolean): void => storage.set(key, value),
  getNumber: (key: string): number | undefined => storage.getNumber(key),
  setNumber: (key: string, value: number): void => storage.set(key, value),
  delete: (key: string): void => { storage.delete(key); },
  clearAll: (): void => storage.clearAll(),

  getObject: <T>(key: string): T | null => {
    const raw = storage.getString(key);
    if (!raw) return null;
    try { return JSON.parse(raw) as T; } catch { return null; }
  },
  setObject: <T>(key: string, value: T): void => {
    storage.set(key, JSON.stringify(value));
  },
};

export const CACHE_KEYS = {
  USER: 'user',
  LANGUAGE: 'language',
  ELDER_MODE: 'elder_mode',
  DARK_MODE: 'dark_mode',
  BIOMETRIC_ENABLED: 'biometric_enabled',
  SHORTLIST_PREFIX: 'shortlist:',
  SHORTLIST_INDEX: 'shortlist_index',
  SHORTLIST_SYNC_TIME: 'shortlist_last_sync',
} as const;
