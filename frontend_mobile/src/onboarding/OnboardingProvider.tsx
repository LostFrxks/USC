import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { router, usePathname } from "expo-router";
import { useSelectedCompany } from "@/session/SelectedCompanyProvider";
import { useSession } from "@/session/SessionProvider";
import { OnboardingOverlay } from "@/onboarding/OnboardingOverlay";
import { getOnboardingSteps } from "@/onboarding/steps";
import { buildOnboardingStateKey, buildOnboardingReplayKey, isReplayRequested, makeOnboardingState, readOnboardingState, setReplayRequested, writeOnboardingState } from "@/onboarding/storage";
import type { MobileOnboardingContext } from "@/onboarding/types";

type OnboardingContextValue = {
  visible: boolean;
  replayRequested: boolean;
  requestReplay(value: boolean): Promise<void>;
  restartNow(): Promise<void>;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const { state, profile } = useSession();
  const { activeCompanyId, appRole } = useSelectedCompany();
  const [visible, setVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [replayFlag, setReplayFlag] = useState(false);

  const context = useMemo<MobileOnboardingContext | null>(() => {
    if (!profile || !activeCompanyId) return null;
    return {
      userId: profile.id,
      companyId: activeCompanyId,
      role: appRole,
    };
  }, [activeCompanyId, appRole, profile]);

  const steps = useMemo(() => getOnboardingSteps(appRole), [appRole]);
  const currentStep = steps[stepIndex] ?? null;

  useEffect(() => {
    let mounted = true;
    async function bootstrap() {
      if (state !== "authenticated" || !context) {
        if (mounted) {
          setVisible(false);
          setReplayFlag(false);
        }
        return;
      }

      const replay = await isReplayRequested(context);
      const persisted = replay ? null : await readOnboardingState(context);
      if (!mounted) return;

      setReplayFlag(replay);

      if (replay) {
        await setReplayRequested(context, false);
        const nextState = makeOnboardingState("in_progress", 0);
        await writeOnboardingState(context, nextState);
        setStepIndex(0);
        setVisible(true);
        return;
      }

      if (!persisted) {
        const nextState = makeOnboardingState("in_progress", 0);
        await writeOnboardingState(context, nextState);
        setStepIndex(0);
        setVisible(true);
        return;
      }

      if (persisted.status !== "completed") {
        setStepIndex(persisted.stepIndex);
        setVisible(true);
        return;
      }

      setVisible(false);
    }

    void bootstrap();
    return () => {
      mounted = false;
    };
  }, [context, state]);

  useEffect(() => {
    if (!visible || !currentStep) return;
    if (pathname !== currentStep.route) {
      router.replace(currentStep.route as never);
    }
  }, [currentStep, pathname, visible]);

  const persist = useCallback(async (nextIndex: number, completed: boolean) => {
    if (!context) return;
    await writeOnboardingState(context, makeOnboardingState(completed ? "completed" : "in_progress", nextIndex));
  }, [context]);

  const requestReplay = useCallback(async (value: boolean) => {
    if (!context) return;
    await setReplayRequested(context, value);
    setReplayFlag(value);
  }, [context]);

  const restartNow = useCallback(async () => {
    if (!context) return;
    await persist(0, false);
    setStepIndex(0);
    setVisible(true);
    router.replace(steps[0]?.route as never);
  }, [context, persist, steps]);

  const value = useMemo<OnboardingContextValue>(() => ({
    visible,
    replayRequested: replayFlag,
    requestReplay,
    restartNow,
  }), [replayFlag, requestReplay, restartNow, visible]);

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      <OnboardingOverlay
        visible={visible}
        step={currentStep}
        stepIndex={stepIndex}
        totalSteps={steps.length}
        onBack={() => {
          const next = Math.max(0, stepIndex - 1);
          setStepIndex(next);
          void persist(next, false);
        }}
        onNext={() => {
          const next = Math.min(steps.length - 1, stepIndex + 1);
          setStepIndex(next);
          void persist(next, false);
        }}
        onSkip={() => {
          setVisible(false);
          void persist(stepIndex, true);
        }}
        onFinish={() => {
          setVisible(false);
          void persist(stepIndex, true);
        }}
      />
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used inside OnboardingProvider");
  }
  return context;
}
