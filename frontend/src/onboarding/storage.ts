import {
  ONBOARDING_ENGINE_VERSION,
  ONBOARDING_GUIDE_CONTENT_VERSION,
  ONBOARDING_STORAGE_NAMESPACE,
  ONBOARDING_STORAGE_SCHEMA_VERSION,
} from "./constants";
import type { OnboardingPersistedState, OnboardingStatus, OnboardingStorageContext } from "./types";

function normalizeRole(role: string): string {
  return String(role || "unknown").trim().toLowerCase() || "unknown";
}

export function buildOnboardingStateKey(context: OnboardingStorageContext): string {
  return `${ONBOARDING_STORAGE_NAMESPACE}.state.${context.userId}.${normalizeRole(context.role)}`;
}

export function buildOnboardingReplayKey(context: OnboardingStorageContext): string {
  return `${ONBOARDING_STORAGE_NAMESPACE}.replay_once.${context.userId}.${normalizeRole(context.role)}`;
}

function buildLegacyOnboardingStatePrefix(context: OnboardingStorageContext): string {
  return `${ONBOARDING_STORAGE_NAMESPACE}.state.${context.userId}.`;
}

function buildLegacyOnboardingReplayPrefix(context: OnboardingStorageContext): string {
  return `${ONBOARDING_STORAGE_NAMESPACE}.replay_once.${context.userId}.`;
}

function collectLegacyKeys(prefix: string, role: string): string[] {
  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key) continue;
    if (!key.startsWith(prefix)) continue;
    if (!key.endsWith(`.${role}`)) continue;
    keys.push(key);
  }
  return keys;
}

export function makeOnboardingState(status: OnboardingStatus, stepIndex: number): OnboardingPersistedState {
  return {
    status,
    stepIndex: Math.max(0, Math.floor(stepIndex)),
    lastUpdatedAt: Date.now(),
    engineVersion: ONBOARDING_ENGINE_VERSION,
    storageSchemaVersion: ONBOARDING_STORAGE_SCHEMA_VERSION,
    guideContentVersion: ONBOARDING_GUIDE_CONTENT_VERSION,
  };
}

function parsePersistedState(raw: string | null): OnboardingPersistedState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<OnboardingPersistedState>;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.storageSchemaVersion !== ONBOARDING_STORAGE_SCHEMA_VERSION) return null;
    if (parsed.engineVersion !== ONBOARDING_ENGINE_VERSION) return null;
    if (parsed.guideContentVersion !== ONBOARDING_GUIDE_CONTENT_VERSION) return null;
    if (!["not_started", "in_progress", "completed"].includes(String(parsed.status || ""))) return null;
    if (!Number.isFinite(parsed.stepIndex)) return null;
    return {
      status: parsed.status as OnboardingStatus,
      stepIndex: Math.max(0, Math.floor(Number(parsed.stepIndex))),
      lastUpdatedAt: Number(parsed.lastUpdatedAt) || Date.now(),
      engineVersion: String(parsed.engineVersion),
      storageSchemaVersion: Number(parsed.storageSchemaVersion),
      guideContentVersion: String(parsed.guideContentVersion),
    };
  } catch {
    return null;
  }
}

export function readOnboardingState(context: OnboardingStorageContext): OnboardingPersistedState | null {
  const nextKey = buildOnboardingStateKey(context);
  const nextState = parsePersistedState(localStorage.getItem(nextKey));
  if (nextState) return nextState;

  const role = normalizeRole(context.role);
  const legacyKeys = collectLegacyKeys(buildLegacyOnboardingStatePrefix(context), role);
  let latestLegacyState: OnboardingPersistedState | null = null;

  for (const legacyKey of legacyKeys) {
    const parsed = parsePersistedState(localStorage.getItem(legacyKey));
    if (!parsed) continue;
    if (!latestLegacyState || parsed.lastUpdatedAt > latestLegacyState.lastUpdatedAt) {
      latestLegacyState = parsed;
    }
  }

  if (!latestLegacyState) return null;

  try {
    localStorage.setItem(nextKey, JSON.stringify(latestLegacyState));
  } catch {
    // ignore quota/storage errors
  }
  return latestLegacyState;
}

export function writeOnboardingState(context: OnboardingStorageContext, state: OnboardingPersistedState): void {
  try {
    localStorage.setItem(buildOnboardingStateKey(context), JSON.stringify(state));
  } catch {
    // ignore quota/storage errors
  }
}

export function isOnboardingReplayRequested(context: OnboardingStorageContext): boolean {
  try {
    const nextKey = buildOnboardingReplayKey(context);
    if (localStorage.getItem(nextKey) === "1") return true;

    const role = normalizeRole(context.role);
    const legacyKeys = collectLegacyKeys(buildLegacyOnboardingReplayPrefix(context), role);
    const hasLegacyReplay = legacyKeys.some((key) => localStorage.getItem(key) === "1");
    if (!hasLegacyReplay) return false;

    localStorage.setItem(nextKey, "1");
    for (const key of legacyKeys) {
      localStorage.removeItem(key);
    }
    return true;
  } catch {
    return false;
  }
}

export function setOnboardingReplayRequested(context: OnboardingStorageContext, value: boolean): void {
  try {
    const key = buildOnboardingReplayKey(context);
    const legacyKeys = collectLegacyKeys(buildLegacyOnboardingReplayPrefix(context), normalizeRole(context.role));
    if (value) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
    if (!value) {
      for (const legacyKey of legacyKeys) {
        localStorage.removeItem(legacyKey);
      }
    }
  } catch {
    // ignore
  }
}
