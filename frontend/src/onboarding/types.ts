export type OnboardingStatus = "not_started" | "in_progress" | "completed";

export type OnboardingMode = "info" | "interaction_required";

export type OnboardingScreen = "home" | "cart" | "analytics" | "ai" | "profile";

export type OnboardingStep = {
  id: string;
  title: string;
  description: string;
  mode: OnboardingMode;
  screen?: OnboardingScreen;
  targetSelector?: string;
  actionHint?: string;
};

export type OnboardingStorageContext = {
  userId: number;
  companyId: number;
  role: string;
};

export type OnboardingPersistedState = {
  status: OnboardingStatus;
  stepIndex: number;
  lastUpdatedAt: number;
  engineVersion: string;
  storageSchemaVersion: number;
  guideContentVersion: string;
};

