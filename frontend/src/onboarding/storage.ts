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
  return `${ONBOARDING_STORAGE_NAMESPACE}.state.${context.userId}.${context.companyId}.${normalizeRole(context.role)}`;
}

export function buildOnboardingReplayKey(context: OnboardingStorageContext): string {
  return `${ONBOARDING_STORAGE_NAMESPACE}.replay_once.${context.userId}.${context.companyId}.${normalizeRole(context.role)}`;
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

export function readOnboardingState(context: OnboardingStorageContext): OnboardingPersistedState | null {
  try {
    const raw = localStorage.getItem(buildOnboardingStateKey(context));
    if (!raw) return null;
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

export function writeOnboardingState(context: OnboardingStorageContext, state: OnboardingPersistedState): void {
  try {
    localStorage.setItem(buildOnboardingStateKey(context), JSON.stringify(state));
  } catch {
    // ignore quota/storage errors
  }
}

export function isOnboardingReplayRequested(context: OnboardingStorageContext): boolean {
  try {
    return localStorage.getItem(buildOnboardingReplayKey(context)) === "1";
  } catch {
    return false;
  }
}

export function setOnboardingReplayRequested(context: OnboardingStorageContext, value: boolean): void {
  try {
    const key = buildOnboardingReplayKey(context);
    if (value) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

