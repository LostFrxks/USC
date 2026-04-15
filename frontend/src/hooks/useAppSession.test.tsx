import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAppSession } from "./useAppSession";

const mockFetchMe = vi.fn();
const mockFetchNotifications = vi.fn();

vi.mock("../api/auth", () => ({
  bootstrapSession: vi.fn().mockResolvedValue(true),
  logout: vi.fn(),
  logoutAllRequest: vi.fn(),
  logoutLocal: vi.fn(),
}));

vi.mock("../api/profile", () => ({
  fetchMe: (...args: unknown[]) => mockFetchMe(...args),
}));

vi.mock("../api/notifications", () => ({
  fetchNotifications: (...args: unknown[]) => mockFetchNotifications(...args),
}));

vi.mock("../api/client", () => ({
  hasAccessToken: vi.fn(() => true),
  isApiError: vi.fn(() => false),
  SESSION_EXPIRED_EVENT: "usc:session-expired",
}));

describe("useAppSession", () => {
  beforeEach(() => {
    localStorage.clear();
    mockFetchNotifications.mockResolvedValue({ unread_count: 0 });
  });

  it("derives app role from active company instead of legacy localStorage role", async () => {
    localStorage.setItem("usc_company_id", "20");
    localStorage.setItem("usc_app_role", "buyer");
    mockFetchMe.mockResolvedValue({
      id: 1,
      email: "owner@test.local",
      first_name: "Owner",
      last_name: "User",
      companies: [
        { company_id: 10, name: "Buyer Co", company_type: "BUYER" },
        { company_id: 20, name: "Supplier Co", company_type: "SUPPLIER" },
      ],
    });

    const { result } = renderHook(() => useAppSession());

    await waitFor(() => expect(result.current.profile?.companies).toHaveLength(2));
    expect(result.current.companyId).toBe(20);
    expect(result.current.appRole).toBe("supplier");
  });
});
