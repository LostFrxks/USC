import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AboutScreen from "./AboutScreen";

describe("AboutScreen advanced onboarding controls", () => {
  it("opens advanced block after 5 taps on version and toggles replay checkbox", () => {
    const onReplay = vi.fn();
    render(
      <AboutScreen
        active
        onBurger={() => undefined}
        onboardingReplayRequested={false}
        onRequestOnboardingReplay={onReplay}
      />
    );

    const versionButton = screen.getByRole("button", { name: /v0\.1 mvp/i });
    for (let i = 0; i < 5; i += 1) {
      fireEvent.click(versionButton);
    }

    expect(screen.getByTestId("about-advanced")).toBeInTheDocument();
    const checkbox = screen.getByRole("checkbox", { name: "Пройти гайд еще раз при следующем входе" });
    fireEvent.click(checkbox);
    expect(onReplay).toHaveBeenCalledWith(true);
  });
});

