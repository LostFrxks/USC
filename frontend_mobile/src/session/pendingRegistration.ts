import { STORAGE_KEYS, getStoredJson, removeStoredValue, setStoredJson } from "@/storage/appStorage";

export type PendingRegistration = {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
};

export function savePendingRegistration(payload: PendingRegistration) {
  return setStoredJson(STORAGE_KEYS.pendingRegistration, payload);
}

export function readPendingRegistration() {
  return getStoredJson<PendingRegistration>(STORAGE_KEYS.pendingRegistration);
}

export function clearPendingRegistration() {
  return removeStoredValue(STORAGE_KEYS.pendingRegistration);
}
