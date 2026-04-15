import type { AppRole } from "@usc/core";

export type LeverDraft = {
  deliveryImprovePp: string;
  cancelReducePp: string;
  promoIntensityPct: string;
  roleSpecificA: string;
  roleSpecificB: string;
};

export type ScenarioPresetMode = "soft" | "balanced" | "boost";

export function makeLeverDraft(): LeverDraft {
  return {
    deliveryImprovePp: "0",
    cancelReducePp: "0",
    promoIntensityPct: "0",
    roleSpecificA: "0",
    roleSpecificB: "0",
  };
}

export function applyLeverPreset(role: AppRole, mode: ScenarioPresetMode): LeverDraft {
  if (role === "supplier") {
    if (mode === "soft") {
      return {
        deliveryImprovePp: "2",
        cancelReducePp: "1",
        promoIntensityPct: "3",
        roleSpecificA: "3",
        roleSpecificB: "10",
      };
    }
    if (mode === "balanced") {
      return {
        deliveryImprovePp: "5",
        cancelReducePp: "2",
        promoIntensityPct: "7",
        roleSpecificA: "6",
        roleSpecificB: "20",
      };
    }
    return {
      deliveryImprovePp: "9",
      cancelReducePp: "4",
      promoIntensityPct: "12",
      roleSpecificA: "10",
      roleSpecificB: "30",
    };
  }

  if (mode === "soft") {
    return {
      deliveryImprovePp: "2",
      cancelReducePp: "1",
      promoIntensityPct: "3",
      roleSpecificA: "10",
      roleSpecificB: "10",
    };
  }
  if (mode === "balanced") {
    return {
      deliveryImprovePp: "5",
      cancelReducePp: "2",
      promoIntensityPct: "7",
      roleSpecificA: "20",
      roleSpecificB: "20",
    };
  }
  return {
    deliveryImprovePp: "9",
    cancelReducePp: "4",
    promoIntensityPct: "12",
    roleSpecificA: "35",
    roleSpecificB: "30",
  };
}

export function draftFromScenarioLevers(
  role: AppRole,
  levers: {
    deliveryImprovePp?: number;
    cancelReducePp?: number;
    promoIntensityPct?: number;
    cheaperSupplierShiftPct?: number;
    reliableSupplierShiftPct?: number;
    priceCutOverpricedPct?: number;
    pipelineRecoveryPct?: number;
  }
): LeverDraft {
  return {
    deliveryImprovePp: String(levers.deliveryImprovePp ?? 0),
    cancelReducePp: String(levers.cancelReducePp ?? 0),
    promoIntensityPct: String(levers.promoIntensityPct ?? 0),
    roleSpecificA: String(role === "supplier" ? levers.priceCutOverpricedPct ?? 0 : levers.cheaperSupplierShiftPct ?? 0),
    roleSpecificB: String(role === "supplier" ? levers.pipelineRecoveryPct ?? 0 : levers.reliableSupplierShiftPct ?? 0),
  };
}

export function activeLeverLabels(role: AppRole, draft: LeverDraft): Array<{ label: string; value: string }> {
  const items =
    role === "supplier"
      ? [
          { label: "Delivery", value: draft.deliveryImprovePp, suffix: "pp" },
          { label: "Cancel", value: draft.cancelReducePp, suffix: "pp" },
          { label: "Promo", value: draft.promoIntensityPct, suffix: "%" },
          { label: "Price", value: draft.roleSpecificA, suffix: "%" },
          { label: "Recovery", value: draft.roleSpecificB, suffix: "%" },
        ]
      : [
          { label: "Delivery", value: draft.deliveryImprovePp, suffix: "pp" },
          { label: "Cancel", value: draft.cancelReducePp, suffix: "pp" },
          { label: "Promo", value: draft.promoIntensityPct, suffix: "%" },
          { label: "Cheaper shift", value: draft.roleSpecificA, suffix: "%" },
          { label: "Reliable shift", value: draft.roleSpecificB, suffix: "%" },
        ];

  return items
    .map((item) => ({ ...item, numeric: Number(item.value.replace(",", ".")) }))
    .filter((item) => Number.isFinite(item.numeric) && item.numeric > 0)
    .sort((a, b) => b.numeric - a.numeric)
    .map((item) => ({ label: item.label, value: `${item.value}${item.suffix}` }));
}
