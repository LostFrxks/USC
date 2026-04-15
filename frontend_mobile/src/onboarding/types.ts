import type { AppRole } from "@usc/core";

export type MobileOnboardingStatus = "not_started" | "in_progress" | "completed";

export type MobileOnboardingContext = {
  userId: number;
  companyId: number;
  role: AppRole;
};

export type MobileOnboardingStep = {
  id: string;
  title: string;
  description: string;
  route: string;
  accent?: "brand" | "action" | "insight" | "success";
};

export type MobileOnboardingState = {
  status: MobileOnboardingStatus;
  stepIndex: number;
  lastUpdatedAt: number;
  schemaVersion: number;
  guideVersion: string;
};
