import { useEffect, useState } from "react";
import { isApiError } from "../api/client";
import { supplierConfirmOrder } from "../api/orders";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from "../api/notifications";
import type { ToastTone } from "../hooks/useToast";
import SecondaryTopbar from "../ui/SecondaryTopbar";

function canConfirm(status?: string | null): boolean {
  const up = (status || "").toUpperCase();
  return up === "PENDING" || up === "CREATED";
}

function extractOrderId(item: NotificationItem): number | null {
  if (item.resource_type === "order") {
    const id = Number(item.resource_id);
    if (Number.isFinite(id) && id > 0) return id;
  }
  const orderFromPayload = Number((item.payload as { order_id?: unknown } | undefined)?.order_id);
  if (Number.isFinite(orderFromPayload) && orderFromPayload > 0) return orderFromPayload;
  return null;
}

function extractStatus(item: NotificationItem): string | null {
  const status = (item.payload as { status?: unknown } | undefined)?.status;
  return typeof status === "string" ? status : null;
}

export default function NotificationsScreen({
  active,
  onBurger,
  onOpenNotifications,
  notificationCount,
  role,
  onOpenOrder,
  onNotify,
  onSessionExpired,
  onUnreadCountChange,
}: {
  active: boolean;
  onBurger: () => void;
  onOpenNotifications?: () => void;
  notificationCount?: number;
  role?: string | null;
  onOpenOrder: (orderId: number) => void;
  onNotify: (message: string, tone?: ToastTone) => void;
  onSessionExpired?: () => void;
  onUnreadCountChange?: (count: number) => void;
}) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = () => {
    if (!localStorage.getItem("usc_access_token")) {
      onSessionExpired?.();
      return;
    }
    setLoading(true);
    setError(false);
    fetchNotifications(30)
      .then((data) => {
        setItems(data.items ?? []);
        setUnreadCount(data.unread_count ?? 0);
        onUnreadCountChange?.(data.unread_count ?? 0);
      })
      .catch((error: unknown) => {
        if (isApiError(error) && error.status === 401) {
          onSessionExpired?.();
          return;
        }
        setError(true);
        setItems([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!active) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const isSupplier = (role || "").toLowerCase() === "supplier";

  return (
    <section id="screen-notifications" className={`screen ${active ? "active" : ""}`}>
      <SecondaryTopbar onBurger={onBurger} onNotifications={onOpenNotifications} notificationCount={notificationCount} />

      <header className="simple-header">
        <div className="simple-title">Уведомления</div>
      </header>

      <div className="notifications-list">
        <div className="notification-toolbar">
          <div className="notification-unread">Непрочитано: {unreadCount}</div>
          <button
            className="notification-action-btn"
            type="button"
            onClick={async () => {
              try {
                await markAllNotificationsRead();
                await load();
              } catch {
                onNotify("Не удалось отметить уведомления как прочитанные", "error");
              }
            }}
          >
            Прочитать все
          </button>
        </div>

        {loading ? (
          <div className="notifications-empty">Загружаем уведомления...</div>
        ) : error ? (
          <div className="notifications-empty">Не удалось загрузить уведомления</div>
        ) : items.length === 0 ? (
          <div className="notifications-empty">Уведомлений пока нет</div>
        ) : (
          items.map((n) => {
            const date = n.created_at ? new Date(n.created_at) : null;
            const meta =
              date && !Number.isNaN(date.getTime())
                ? new Intl.DateTimeFormat("ru-RU", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(date)
                : "";

            const orderId = extractOrderId(n);
            const status = extractStatus(n);
            const isOrder = typeof orderId === "number" && orderId > 0;
            const confirmable = isSupplier && n.resource_type === "order" && canConfirm(status);
            const actionLoading = busyId === n.id;

            return (
              <div className="notification-item" key={n.id}>
                <div className={"notification-dot" + (n.is_read ? " dim" : "")} />
                <div className="notification-content">
                  <div className="notification-title">{n.title}</div>
                  <div className="notification-text">{n.text}</div>
                  <div className="notification-meta">{meta}</div>

                  {(isOrder || confirmable) && (
                    <div className="notification-actions">
                      {isOrder && (
                        <button
                          className="notification-action-btn"
                          type="button"
                          onClick={async () => {
                            if (!orderId) return;
                            try {
                              await markNotificationRead(n.id);
                            } catch {
                              // ignore read errors and still allow navigation
                            }
                            onOpenOrder(orderId);
                            load();
                          }}
                        >
                          Открыть заказ
                        </button>
                      )}

                      {confirmable && (
                        <button
                          className="notification-action-btn notification-action-btn-primary"
                          type="button"
                          disabled={actionLoading}
                          onClick={async () => {
                            if (!orderId) return;
                            setBusyId(n.id);
                            try {
                              await supplierConfirmOrder(orderId);
                              await markNotificationRead(n.id).catch(() => undefined);
                              onNotify(`Заказ USC-${orderId} подтвержден`, "success");
                              await load();
                            } catch {
                              onNotify("Не удалось подтвердить заказ", "error");
                            } finally {
                              setBusyId(null);
                            }
                          }}
                        >
                          {actionLoading ? "..." : "Подтвердить"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

