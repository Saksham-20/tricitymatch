import * as SecureStore from 'expo-secure-store';

const REFRESH_TOKEN_KEY = 'refreshToken';

export const secureStorage = {
  getRefreshToken: async (): Promise<string | null> => {
    return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  },
  setRefreshToken: async (token: string): Promise<void> => {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  },
  deleteRefreshToken: async (): Promise<void> => {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  },
};
