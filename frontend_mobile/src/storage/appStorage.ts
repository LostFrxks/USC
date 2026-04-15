import AsyncStorage from "@react-native-async-storage/async-storage";

export const STORAGE_KEYS = {
  activeCompanyId: "usc.mobile.activeCompanyId",
  cart: "usc.mobile.cart",
  pendingRegistration: "usc.mobile.pendingRegistration",
} as const;

export async function getStoredJson<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setStoredJson(key: string, value: unknown): Promise<void> {
  return AsyncStorage.setItem(key, JSON.stringify(value));
}

export function removeStoredValue(key: string): Promise<void> {
  return AsyncStorage.removeItem(key);
}
