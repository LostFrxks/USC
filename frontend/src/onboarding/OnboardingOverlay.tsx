import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { OnboardingStep } from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export default function OnboardingOverlay({
  visible,
  step,
  stepIndex,
  totalSteps,
  canGoNext,
  onBack,
  onNext,
  onSkip,
  onFinish,
  onTargetFoundChange,
}: {
  visible: boolean;
  step: OnboardingStep | null;
  stepIndex: number;
  totalSteps: number;
  canGoNext: boolean;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
  onFinish: () => void;
  onTargetFoundChange?: (found: boolean) => void;
}) {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [targetFound, setTargetFound] = useState(false);

  useEffect(() => {
    const selector = step?.targetSelector;
    if (!visible || !selector) {
      setTargetRect(null);
      setTargetFound(false);
      onTargetFoundChange?.(false);
      return;
    }

    const update = () => {
      const node = document.querySelector(selector);
      if (!node || !(node instanceof HTMLElement)) {
        setTargetRect(null);
        setTargetFound(false);
        onTargetFoundChange?.(false);
        return;
      }
      const rect = node.getBoundingClientRect();
      const valid = rect.width > 0 && rect.height > 0;
      setTargetRect(valid ? rect : null);
      setTargetFound(valid);
      onTargetFoundChange?.(valid);
    };

    update();
    const onScroll = () => update();
    const onResize = () => update();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    const poll = window.setInterval(update, 180);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      window.clearInterval(poll);
    };
  }, [onTargetFoundChange, step?.targetSelector, visible]);

  const isLast = stepIndex >= totalSteps - 1;
  const showBack = stepIndex > 0;
  const progressPct = useMemo(() => {
    if (!totalSteps) return 0;
    return ((stepIndex + 1) / totalSteps) * 100;
  }, [stepIndex, totalSteps]);
  const progressSegments = useMemo(
    () => Array.from({ length: totalSteps }, (_, index) => index <= stepIndex),
    [stepIndex, totalSteps]
  );

  const nextLabel = useMemo(() => {
    if (isLast) return "Завершить";
    if (step?.id === "welcome") return "Начать";
    return "Далее";
  }, [isLast, step?.id]);

  const actionLocked = step?.mode === "interaction_required" && !canGoNext && targetFound;
  const accentClass = step?.accent ? `is-${step.accent}` : "is-brand";
  const cardStyle = useMemo(() => {
    if (!targetRect) return undefined;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const cardW = Math.min(372, viewportW - 24);
    const belowTop = targetRect.bottom + 14;
    const aboveTop = targetRect.top - 14;
    const placeBelow = belowTop + 260 < viewportH;
    const baseLeft = targetRect.left + targetRect.width / 2 - cardW / 2;
    const left = clamp(baseLeft, 12, viewportW - cardW - 12);

    if (placeBelow) {
      return { top: belowTop, bottom: "auto", left, width: cardW } as CSSProperties;
    }
    return { top: Math.max(12, aboveTop - 240), bottom: "auto", left, width: cardW } as CSSProperties;
  }, [targetRect]);

  if (!visible || !step) return null;

  return (
    <div className="onboarding-root" aria-live="polite">
      {targetRect ? (
        <>
          <div className="onboarding-scrim onboarding-scrim-top" style={{ height: Math.max(0, targetRect.top) }} />
          <div className="onboarding-scrim onboarding-scrim-left" style={{ top: targetRect.top, width: Math.max(0, targetRect.left), height: targetRect.height }} />
          <div
            className="onboarding-scrim onboarding-scrim-right"
            style={{
              top: targetRect.top,
              left: targetRect.right,
              width: Math.max(0, window.innerWidth - targetRect.right),
              height: targetRect.height,
            }}
          />
          <div
            className="onboarding-scrim onboarding-scrim-bottom"
            style={{ top: targetRect.bottom, height: Math.max(0, window.innerHeight - targetRect.bottom) }}
          />
          <div
            className="onboarding-target-ring"
            style={{ top: targetRect.top - 6, left: targetRect.left - 6, width: targetRect.width + 12, height: targetRect.height + 12 }}
          />
        </>
      ) : (
        <div className="onboarding-scrim onboarding-scrim-full" />
      )}

      <aside
        className={`onboarding-card ${accentClass}`}
        style={{ ...cardStyle, ["--onboarding-total" as string]: String(Math.max(1, totalSteps)) }}
      >
        <div className="onboarding-card-glow" aria-hidden="true" />

        <div className="onboarding-progress-row">
          <div className="onboarding-progress-copy">
            <div className="onboarding-progress">{`${stepIndex + 1}/${totalSteps}`}</div>
            {step.eyebrow ? <div className="onboarding-eyebrow">{step.eyebrow}</div> : null}
          </div>
          <div className="onboarding-progress-meter" aria-hidden="true">
            <span style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <div className="onboarding-progress-segments" aria-hidden="true">
          {progressSegments.map((isDone, index) => (
            <span key={index} className={isDone ? "done" : ""} />
          ))}
        </div>

        <div className="onboarding-copy">
          <h3>{step.title}</h3>
          <p>{step.description}</p>
        </div>

        {step.mode === "interaction_required" ? (
          <div className={`onboarding-action-hint ${actionLocked ? "pending" : "done"}`}>
            {actionLocked ? step.actionHint || "Выполните действие, чтобы продолжить." : "Отлично, можно переходить дальше."}
          </div>
        ) : null}

        {!targetFound && step.targetSelector ? (
          <div className="onboarding-action-hint fallback">Целевой элемент не найден, можно продолжить.</div>
        ) : null}

        <div className="onboarding-actions">
          {showBack ? (
            <button type="button" className="onboarding-btn ghost" onClick={onBack}>
              Назад
            </button>
          ) : (
            <span />
          )}
          <button type="button" className="onboarding-btn ghost" onClick={onSkip}>
            Пропустить
          </button>
          <button
            type="button"
            className="onboarding-btn primary"
            onClick={isLast ? onFinish : onNext}
            disabled={step.mode === "interaction_required" && !canGoNext && targetFound}
          >
            {nextLabel}
          </button>
        </div>
      </aside>
    </div>
  );
}
