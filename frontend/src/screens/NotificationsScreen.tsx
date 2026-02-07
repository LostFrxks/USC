import { useEffect, useState } from "react";
import { supplierConfirmOrder } from "../api/orders";
import { fetchNotifications, type NotificationItem } from "../api/notifications";
import type { ToastTone } from "../hooks/useToast";
import SecondaryTopbar from "../ui/SecondaryTopbar";

function canConfirm(status?: string | null): boolean {
  const up = (status || "").toUpperCase();
  return up === "PENDING" || up === "CREATED";
}

export default function NotificationsScreen({
  active,
  onBurger,
  onOpenNotifications,
  notificationCount,
  role,
  onOpenOrder,
  onNotify,
}: {
  active: boolean;
  onBurger: () => void;
  onOpenNotifications?: () => void;
  notificationCount?: number;
  role?: string | null;
  onOpenOrder: (orderId: number) => void;
  onNotify: (message: string, tone?: ToastTone) => void;
}) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(false);
    fetchNotifications(30)
      .then((data) => setItems(data))
      .catch(() => {
        setError(true);
        setItems([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!active) return;
    let alive = true;
    setLoading(true);
    setError(false);

    fetchNotifications(30)
      .then((data) => {
        if (!alive) return;
        setItems(data);
      })
      .catch(() => {
        if (!alive) return;
        setError(true);
        setItems([]);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [active]);

  const isSupplier = (role || "").toLowerCase() === "supplier";

  return (
    <section id="screen-notifications" className={`screen ${active ? "active" : ""}`}>
      <SecondaryTopbar onBurger={onBurger} onNotifications={onOpenNotifications} notificationCount={notificationCount} />

      <header className="simple-header">
        <div className="simple-title">{"\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f"}</div>
      </header>

      <div className="notifications-list">
        {loading ? (
          <div className="notifications-empty">{"\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043c \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f..."}</div>
        ) : error ? (
          <div className="notifications-empty">{"\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f"}</div>
        ) : items.length === 0 ? (
          <div className="notifications-empty">{"\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0439 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442"}</div>
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

            const isOrder = typeof n.order_id === "number";
            const confirmable = isSupplier && n.type === "order" && canConfirm(n.status);
            const actionLoading = busyId === n.id;

            return (
              <div className="notification-item" key={n.id}>
                <div className={"notification-dot" + (n.is_new ? "" : " dim")} />
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
                          onClick={() => onOpenOrder(Number(n.order_id))}
                        >
                          {"\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0437\u0430\u043a\u0430\u0437"}
                        </button>
                      )}

                      {confirmable && (
                        <button
                          className="notification-action-btn notification-action-btn-primary"
                          type="button"
                          disabled={actionLoading}
                          onClick={async () => {
                            if (!n.order_id) return;
                            setBusyId(n.id);
                            try {
                              await supplierConfirmOrder(n.order_id);
                              onNotify(`\u0417\u0430\u043a\u0430\u0437 USC-${n.order_id} \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d`, "success");
                              load();
                            } catch {
                              onNotify("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c \u0437\u0430\u043a\u0430\u0437", "error");
                            } finally {
                              setBusyId(null);
                            }
                          }}
                        >
                          {actionLoading ? "..." : "\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c"}
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
