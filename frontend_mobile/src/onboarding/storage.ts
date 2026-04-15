import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AppRole } from "@usc/core";
import type { MobileOnboardingContext, MobileOnboardingState, MobileOnboardingStatus } from "@/onboarding/types";

const ONBOARDING_NAMESPACE = "usc.mobile.onboarding.v1";
const SCHEMA_VERSION = 1;
const GUIDE_VERSION = "1.0.0";

function normalizeRole(role: AppRole): string {
  return String(role || "buyer").trim().toLowerCase() || "buyer";
}

export function buildOnboardingStateKey(context: MobileOnboardingContext): string {
  return `${ONBOARDING_NAMESPACE}.state.${context.userId}.${context.companyId}.${normalizeRole(context.role)}`;
}

export function buildOnboardingReplayKey(context: MobileOnboardingContext): string {
  return `${ONBOARDING_NAMESPACE}.replay.${context.userId}.${context.companyId}.${normalizeRole(context.role)}`;
}

export function makeOnboardingState(status: MobileOnboardingStatus, stepIndex: number): MobileOnboardingState {
  return {
    status,
    stepIndex: Math.max(0, Math.floor(stepIndex)),
    lastUpdatedAt: Date.now(),
    schemaVersion: SCHEMA_VERSION,
    guideVersion: GUIDE_VERSION,
  };
}

export async function readOnboardingState(context: MobileOnboardingContext): Promise<MobileOnboardingState | null> {
  const raw = await AsyncStorage.getItem(buildOnboardingStateKey(context));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<MobileOnboardingState>;
    if (parsed.schemaVersion !== SCHEMA_VERSION) return null;
    if (parsed.guideVersion !== GUIDE_VERSION) return null;
    if (!["not_started", "in_progress", "completed"].includes(String(parsed.status || ""))) return null;
    if (!Number.isFinite(parsed.stepIndex)) return null;
    return {
      status: parsed.status as MobileOnboardingStatus,
      stepIndex: Math.max(0, Math.floor(Number(parsed.stepIndex))),
      lastUpdatedAt: Number(parsed.lastUpdatedAt) || Date.now(),
      schemaVersion: Number(parsed.schemaVersion),
      guideVersion: String(parsed.guideVersion),
    };
  } catch {
    return null;
  }
}

export function writeOnboardingState(context: MobileOnboardingContext, state: MobileOnboardingState): Promise<void> {
  return AsyncStorage.setItem(buildOnboardingStateKey(context), JSON.stringify(state));
}

export async function isReplayRequested(context: MobileOnboardingContext): Promise<boolean> {
  return (await AsyncStorage.getItem(buildOnboardingReplayKey(context))) === "1";
}

export async function setReplayRequested(context: MobileOnboardingContext, value: boolean): Promise<void> {
  const key = buildOnboardingReplayKey(context);
  if (value) {
    await AsyncStorage.setItem(key, "1");
    return;
  }
  await AsyncStorage.removeItem(key);
}
