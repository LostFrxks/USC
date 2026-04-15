import { beforeEach, describe, expect, it } from "vitest";
import {
  buildOnboardingReplayKey,
  buildOnboardingStateKey,
  isOnboardingReplayRequested,
  makeOnboardingState,
  readOnboardingState,
  setOnboardingReplayRequested,
  writeOnboardingState,
} from "./storage";

const ctx = { userId: 10, companyId: 21, role: "buyer" };

describe("onboarding storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("writes and reads state with versioned key", () => {
    writeOnboardingState(ctx, makeOnboardingState("in_progress", 3));
    const restored = readOnboardingState(ctx);
    expect(restored?.status).toBe("in_progress");
    expect(restored?.stepIndex).toBe(3);
    expect(buildOnboardingStateKey(ctx)).toContain("usc.onboarding.v1.state");
  });

  it("migrates the latest legacy per-company state into the new per-role key", () => {
    localStorage.setItem(
      "usc.onboarding.v1.state.10.21.buyer",
      JSON.stringify({
        ...makeOnboardingState("in_progress", 2),
        lastUpdatedAt: 10,
      })
    );
    localStorage.setItem(
      "usc.onboarding.v1.state.10.99.buyer",
      JSON.stringify({
        ...makeOnboardingState("completed", 6),
        lastUpdatedAt: 20,
      })
    );

    const restored = readOnboardingState(ctx);

    expect(restored?.status).toBe("completed");
    expect(restored?.stepIndex).toBe(6);
    expect(localStorage.getItem(buildOnboardingStateKey(ctx))).toContain("\"status\":\"completed\"");
  });

  it("ignores incompatible or malformed state payload", () => {
    localStorage.setItem(
      buildOnboardingStateKey(ctx),
      JSON.stringify({
        status: "in_progress",
        stepIndex: 2,
        storageSchemaVersion: 99,
        engineVersion: "0.0.1",
        guideContentVersion: "0.0.1",
      })
    );
    expect(readOnboardingState(ctx)).toBeNull();
  });

  it("stores replay flag and clears it", () => {
    setOnboardingReplayRequested(ctx, true);
    expect(isOnboardingReplayRequested(ctx)).toBe(true);
    expect(localStorage.getItem(buildOnboardingReplayKey(ctx))).toBe("1");
    setOnboardingReplayRequested(ctx, false);
    expect(isOnboardingReplayRequested(ctx)).toBe(false);
  });

  it("migrates a legacy replay flag into the per-role key", () => {
    localStorage.setItem("usc.onboarding.v1.replay_once.10.21.buyer", "1");

    expect(isOnboardingReplayRequested(ctx)).toBe(true);
    expect(localStorage.getItem(buildOnboardingReplayKey(ctx))).toBe("1");
    expect(localStorage.getItem("usc.onboarding.v1.replay_once.10.21.buyer")).toBeNull();
  });
});
