import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { resetSessionState } from "../api/client";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
  resetSessionState();
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
