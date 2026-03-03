import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  isOnboardingReplayRequested,
  makeOnboardingState,
  readOnboardingState,
  setOnboardingReplayRequested,
  writeOnboardingState,
} from "./storage";
import type { OnboardingStatus, OnboardingStorageContext } from "./types";

function clampStep(index: number, stepsCount: number): number {
  if (!Number.isFinite(index)) return 0;
  if (stepsCount <= 0) return 0;
  return Math.max(0, Math.min(stepsCount - 1, Math.floor(index)));
}

export function useOnboarding({
  enabled,
  context,
  stepsCount,
}: {
  enabled: boolean;
  context: OnboardingStorageContext | null;
  stepsCount: number;
}) {
  const [status, setStatus] = useState<OnboardingStatus>("not_started");
  const [stepIndex, setStepIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [replayRequested, setReplayRequested] = useState(false);
  const stepIndexRef = useRef(0);

  const safeStepsCount = Math.max(1, Math.floor(stepsCount || 1));
  const contextKey = useMemo(() => {
    if (!context) return null;
    return `${context.userId}.${context.companyId}.${String(context.role || "").toLowerCase()}`;
  }, [context]);

  useEffect(() => {
    stepIndexRef.current = stepIndex;
  }, [stepIndex]);

  useEffect(() => {
    if (!enabled || !context) {
      setIsRunning(false);
      return;
    }

    const replay = isOnboardingReplayRequested(context);
    setReplayRequested(replay);

    if (replay) {
      setOnboardingReplayRequested(context, false);
      const next = makeOnboardingState("in_progress", 0);
      writeOnboardingState(context, next);
      setStatus("in_progress");
      setStepIndex(0);
      setIsRunning(true);
      setReplayRequested(false);
      return;
    }

    const persisted = readOnboardingState(context);
    if (!persisted) {
      const next = makeOnboardingState("in_progress", 0);
      writeOnboardingState(context, next);
      setStatus("in_progress");
      setStepIndex(0);
      setIsRunning(true);
      return;
    }

    const clamped = clampStep(persisted.stepIndex, safeStepsCount);
    setStatus(persisted.status);
    setStepIndex(clamped);
    setIsRunning(persisted.status !== "completed");
  }, [context, contextKey, enabled, safeStepsCount]);

  const persist = useCallback(
    (nextStatus: OnboardingStatus, nextStepIndex: number) => {
      if (!context) return;
      writeOnboardingState(context, makeOnboardingState(nextStatus, clampStep(nextStepIndex, safeStepsCount)));
    },
    [context, safeStepsCount]
  );

  const start = useCallback(
    (fromStep = 0) => {
      const nextStep = clampStep(fromStep, safeStepsCount);
      setStatus("in_progress");
      setStepIndex(nextStep);
      setIsRunning(true);
      persist("in_progress", nextStep);
    },
    [persist, safeStepsCount]
  );

  const resume = useCallback(() => {
    setIsRunning(true);
    if (status === "completed") {
      setStatus("in_progress");
      persist("in_progress", stepIndex);
    }
  }, [persist, status, stepIndex]);

  const next = useCallback(() => {
    setStepIndex((prev) => {
      const lastIndex = safeStepsCount - 1;
      if (prev >= lastIndex) {
        setStatus("completed");
        setIsRunning(false);
        persist("completed", lastIndex);
        return lastIndex;
      }
      const nextStep = clampStep(prev + 1, safeStepsCount);
      setStatus("in_progress");
      setIsRunning(true);
      persist("in_progress", nextStep);
      return nextStep;
    });
  }, [persist, safeStepsCount]);

  const back = useCallback(() => {
    setStepIndex((prev) => {
      const prevStep = clampStep(prev - 1, safeStepsCount);
      setStatus("in_progress");
      setIsRunning(true);
      persist("in_progress", prevStep);
      return prevStep;
    });
  }, [persist, safeStepsCount]);

  const skip = useCallback(() => {
    setStatus("in_progress");
    setIsRunning(false);
    persist("in_progress", stepIndexRef.current);
  }, [persist]);

  const finish = useCallback(() => {
    const lastIndex = safeStepsCount - 1;
    setStatus("completed");
    setStepIndex(lastIndex);
    setIsRunning(false);
    persist("completed", lastIndex);
  }, [persist, safeStepsCount]);

  const requestReplay = useCallback(
    (value: boolean) => {
      if (!context) return;
      setOnboardingReplayRequested(context, value);
      setReplayRequested(value);
    },
    [context]
  );

  return {
    status,
    stepIndex,
    isRunning,
    replayRequested,
    start,
    resume,
    next,
    back,
    skip,
    finish,
    requestReplay,
  };
}
