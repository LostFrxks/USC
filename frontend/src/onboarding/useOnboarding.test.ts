import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { buildOnboardingStateKey, readOnboardingState } from "./storage";
import { useOnboarding } from "./useOnboarding";

const ctx = { userId: 1, companyId: 10, role: "buyer" };

describe("useOnboarding", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts onboarding on first run and persists progress", async () => {
    const { result } = renderHook(() =>
      useOnboarding({
        enabled: true,
        context: ctx,
        stepsCount: 8,
      })
    );

    await waitFor(() => expect(result.current.isRunning).toBe(true));
    expect(result.current.stepIndex).toBe(0);

    act(() => {
      result.current.next();
    });
    await waitFor(() => expect(result.current.stepIndex).toBe(1));
    act(() => {
      result.current.skip();
    });
    await waitFor(() => expect(result.current.isRunning).toBe(false));
    const persisted = readOnboardingState(ctx);
    expect(persisted?.status).toBe("completed");
    expect(persisted?.stepIndex).toBe(1);
  });

  it("resumes from saved in_progress step after remount", async () => {
    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useOnboarding({
          enabled,
          context: ctx,
          stepsCount: 8,
        }),
      { initialProps: { enabled: true } }
    );

    await waitFor(() => expect(result.current.isRunning).toBe(true));
    act(() => {
      result.current.next();
    });
    await waitFor(() => expect(result.current.stepIndex).toBe(1));
    act(() => {
      result.current.next();
    });
    await waitFor(() => expect(result.current.stepIndex).toBe(2));
    act(() => {
      result.current.skip();
    });
    await waitFor(() => expect(result.current.isRunning).toBe(false));

    rerender({ enabled: false });
    rerender({ enabled: true });
    await waitFor(() => expect(result.current.isRunning).toBe(false));
    expect(result.current.stepIndex).toBe(2);
  });

  it("finishes and does not autostart until replay is requested", async () => {
    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useOnboarding({
          enabled,
          context: ctx,
          stepsCount: 3,
        }),
      { initialProps: { enabled: true } }
    );

    await waitFor(() => expect(result.current.isRunning).toBe(true));
    act(() => {
      result.current.finish();
    });
    expect(result.current.isRunning).toBe(false);
    expect(readOnboardingState(ctx)?.status).toBe("completed");

    rerender({ enabled: false });
    rerender({ enabled: true });
    await waitFor(() => expect(result.current.isRunning).toBe(false));

    act(() => result.current.requestReplay(true));
    expect(result.current.replayRequested).toBe(true);

    rerender({ enabled: false });
    rerender({ enabled: true });
    await waitFor(() => expect(result.current.isRunning).toBe(true));
    expect(result.current.stepIndex).toBe(0);
    expect(localStorage.getItem(buildOnboardingStateKey(ctx))).toContain("\"status\":\"in_progress\"");
  });

  it("keeps an active guide running during transient disabled periods", async () => {
    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useOnboarding({
          enabled,
          context: ctx,
          stepsCount: 8,
        }),
      { initialProps: { enabled: true } }
    );

    await waitFor(() => expect(result.current.isRunning).toBe(true));
    act(() => {
      result.current.next();
    });
    await waitFor(() => expect(result.current.stepIndex).toBe(1));

    rerender({ enabled: false });
    expect(result.current.isRunning).toBe(true);
    expect(result.current.stepIndex).toBe(1);

    rerender({ enabled: true });
    expect(result.current.isRunning).toBe(true);
    expect(result.current.stepIndex).toBe(1);
  });
});
