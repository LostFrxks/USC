jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { buildOnboardingReplayKey, buildOnboardingStateKey, isReplayRequested, makeOnboardingState, readOnboardingState, setReplayRequested, writeOnboardingState } from "@/onboarding/storage";

describe("mobile onboarding storage", () => {
  const context = { userId: 1, companyId: 10, role: "buyer" as const };

  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("writes and reads state by context", async () => {
    await writeOnboardingState(context, makeOnboardingState("in_progress", 2));
    const result = await readOnboardingState(context);
    expect(result?.status).toBe("in_progress");
    expect(result?.stepIndex).toBe(2);
    expect(buildOnboardingStateKey(context)).toContain("1.10.buyer");
  });

  it("stores replay flag", async () => {
    await setReplayRequested(context, true);
    expect(await isReplayRequested(context)).toBe(true);
    expect(buildOnboardingReplayKey(context)).toContain("1.10.buyer");
  });
});
