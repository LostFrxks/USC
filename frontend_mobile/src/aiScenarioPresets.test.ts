import { activeLeverLabels, applyLeverPreset, draftFromScenarioLevers, makeLeverDraft } from "@/screens/aiScenarioPresets";

describe("ai scenario presets", () => {
  it("creates an empty lever draft", () => {
    expect(makeLeverDraft()).toEqual({
      deliveryImprovePp: "0",
      cancelReducePp: "0",
      promoIntensityPct: "0",
      roleSpecificA: "0",
      roleSpecificB: "0",
    });
  });

  it("applies buyer preset values", () => {
    expect(applyLeverPreset("buyer", "balanced")).toEqual({
      deliveryImprovePp: "5",
      cancelReducePp: "2",
      promoIntensityPct: "7",
      roleSpecificA: "20",
      roleSpecificB: "20",
    });
  });

  it("restores mobile draft from supplier scenario levers", () => {
    expect(
      draftFromScenarioLevers("supplier", {
        deliveryImprovePp: 3,
        cancelReducePp: 1,
        promoIntensityPct: 5,
        priceCutOverpricedPct: 4,
        pipelineRecoveryPct: 10,
      })
    ).toEqual({
      deliveryImprovePp: "3",
      cancelReducePp: "1",
      promoIntensityPct: "5",
      roleSpecificA: "4",
      roleSpecificB: "10",
    });
  });

  it("lists only active levers in descending order", () => {
    expect(
      activeLeverLabels("buyer", {
        deliveryImprovePp: "2",
        cancelReducePp: "0",
        promoIntensityPct: "7",
        roleSpecificA: "20",
        roleSpecificB: "5",
      })
    ).toEqual([
      { label: "Cheaper shift", value: "20%" },
      { label: "Promo", value: "7%" },
      { label: "Reliable shift", value: "5%" },
      { label: "Delivery", value: "2pp" },
    ]);
  });
});
