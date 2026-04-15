import * as SecureStore from "expo-secure-store";
import type { TokenStore } from "@usc/core";

const ACCESS_KEY = "usc.mobile.access";
const REFRESH_KEY = "usc.mobile.refresh";

export const secureTokenStore: TokenStore = {
  getAccess() {
    return SecureStore.getItemAsync(ACCESS_KEY);
  },

  async setAccess(token) {
    if (!token) {
      await SecureStore.deleteItemAsync(ACCESS_KEY);
      return;
    }
    await SecureStore.setItemAsync(ACCESS_KEY, token);
  },

  getRefresh() {
    return SecureStore.getItemAsync(REFRESH_KEY);
  },

  async setRefresh(token) {
    if (!token) {
      await SecureStore.deleteItemAsync(REFRESH_KEY);
      return;
    }
    await SecureStore.setItemAsync(REFRESH_KEY, token);
  },

  async clear() {
    await Promise.all([SecureStore.deleteItemAsync(ACCESS_KEY), SecureStore.deleteItemAsync(REFRESH_KEY)]);
  },
};
