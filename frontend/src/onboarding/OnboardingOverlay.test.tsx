import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OnboardingOverlay from "./OnboardingOverlay";
import type { OnboardingStep } from "./types";

describe("OnboardingOverlay", () => {
  it("renders info step and handles next", () => {
    const step: OnboardingStep = {
      id: "welcome",
      title: "Добро пожаловать",
      description: "Описание шага",
      mode: "info",
      screen: "home",
    };
    const onNext = vi.fn();
    render(
      <OnboardingOverlay
        visible
        step={step}
        stepIndex={0}
        totalSteps={8}
        canGoNext
        onBack={() => undefined}
        onNext={onNext}
        onSkip={() => undefined}
        onFinish={() => undefined}
      />
    );

    expect(screen.getByText("Добро пожаловать")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Начать" }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("disables next on interaction step until condition passes", async () => {
    const target = document.createElement("button");
    target.setAttribute("data-tour-id", "top-burger");
    target.getBoundingClientRect = () =>
      ({
        top: 10,
        left: 10,
        right: 50,
        bottom: 50,
        width: 40,
        height: 40,
        x: 10,
        y: 10,
        toJSON: () => ({}),
      }) as DOMRect;
    document.body.appendChild(target);

    const step: OnboardingStep = {
      id: "open_drawer",
      title: "Откройте меню",
      description: "Нажмите кнопку меню",
      mode: "interaction_required",
      screen: "home",
      actionHint: "Нужно действие",
      targetSelector: '[data-tour-id="top-burger"]',
    };
    render(
      <OnboardingOverlay
        visible
        step={step}
        stepIndex={1}
        totalSteps={8}
        canGoNext={false}
        onBack={() => undefined}
        onNext={() => undefined}
        onSkip={() => undefined}
        onFinish={() => undefined}
      />
    );

    await waitFor(() => expect(screen.getByRole("button", { name: "Далее" })).toBeDisabled());
    target.remove();
  });

  it("calls skip callback", () => {
    const onSkip = vi.fn();
    const step: OnboardingStep = {
      id: "home_products",
      title: "Витрина",
      description: "Описание",
      mode: "info",
      screen: "home",
    };
    render(
      <OnboardingOverlay
        visible
        step={step}
        stepIndex={2}
        totalSteps={8}
        canGoNext
        onBack={() => undefined}
        onNext={() => undefined}
        onSkip={onSkip}
        onFinish={() => undefined}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Пропустить" }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
