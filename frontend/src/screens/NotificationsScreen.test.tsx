import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import NotificationsScreen from "./NotificationsScreen";

vi.mock("../api/orders", () => ({
  supplierConfirmOrder: vi.fn(async () => ({})),
}));

const mockFetchNotifications = vi.fn();
const mockMarkAll = vi.fn();
const mockMarkOne = vi.fn();

vi.mock("../api/notifications", () => ({
  fetchNotifications: (...args: unknown[]) => mockFetchNotifications(...args),
  markAllNotificationsRead: (...args: unknown[]) => mockMarkAll(...args),
  markNotificationRead: (...args: unknown[]) => mockMarkOne(...args),
}));

describe("NotificationsScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("usc_access_token", "token");
  });

  it("renders notifications list and unread counter", async () => {
    mockFetchNotifications.mockResolvedValueOnce({
      unread_count: 1,
      items: [
        {
          id: 1,
          domain: "order",
          event_type: "order_created",
          resource_type: "order",
          resource_id: "123",
          title: "Новый заказ",
          text: "Статус: PENDING",
          is_read: false,
          created_at: new Date().toISOString(),
        },
      ],
    });

    render(
      <NotificationsScreen
        active
        onBurger={() => undefined}
        onOpenOrder={() => undefined}
        onNotify={() => undefined}
      />
    );

    expect(await screen.findByText("Новый заказ")).toBeInTheDocument();
    expect(screen.getByText(/Непрочитано:/)).toHaveTextContent("Непрочитано: 1");
  });

  it("marks all notifications as read", async () => {
    mockFetchNotifications
      .mockResolvedValueOnce({
        unread_count: 2,
        items: [],
      })
      .mockResolvedValueOnce({
        unread_count: 0,
        items: [],
      });
    mockMarkAll.mockResolvedValueOnce({ updated_count: 2 });

    render(
      <NotificationsScreen
        active
        onBurger={() => undefined}
        onOpenOrder={() => undefined}
        onNotify={() => undefined}
      />
    );

    const button = await screen.findByRole("button", { name: "Прочитать все" });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockMarkAll).toHaveBeenCalledTimes(1);
      expect(mockFetchNotifications).toHaveBeenCalledTimes(2);
    });
  });
});

