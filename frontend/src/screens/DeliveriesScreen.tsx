import { useEffect, useMemo, useState } from "react";
import SecondaryTopbar from "../ui/SecondaryTopbar";
import { fetchDeliveries, setDeliveryStatus, type Delivery } from "../api/deliveries";

const STATUS_VALUES = ["ASSIGNED", "PICKED_UP", "ON_THE_WAY", "DELIVERED", "FAILED"] as const;
const STATUSES = ["ALL", ...STATUS_VALUES] as const;

type StatusValue = (typeof STATUS_VALUES)[number];
type StatusFilter = (typeof STATUSES)[number];

function statusKey(status?: string | null): StatusValue | "UNKNOWN" {
  const key = (status || "").toUpperCase();
  if ((STATUS_VALUES as readonly string[]).includes(key)) return key as StatusValue;
  return "UNKNOWN";
}

function statusLabel(status?: string | null) {
  switch ((status || "").toUpperCase()) {
    case "ASSIGNED":
      return "Назначена";
    case "PICKED_UP":
      return "Забран";
    case "ON_THE_WAY":
      return "В пути";
    case "DELIVERED":
      return "Доставлен";
    case "FAILED":
      return "Срыв";
    default:
      return status || "—";
  }
}

function filterLabel(status: StatusFilter) {
  switch (status) {
    case "ALL":
      return "Все";
    case "ASSIGNED":
      return "Назначены";
    case "PICKED_UP":
      return "Забраны";
    case "ON_THE_WAY":
      return "В пути";
    case "DELIVERED":
      return "Доставлены";
    case "FAILED":
      return "Срыв";
    default:
      return status;
  }
}

export default function DeliveriesScreen({
  active,
  onBurger,
  onOpenNotifications,
  notificationCount,
}: {
  active: boolean;
  onBurger: () => void;
  onOpenNotifications?: () => void;
  notificationCount?: number;
}) {
  const [items, setItems] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>("ALL");

  useEffect(() => {
    if (!active) return;
    let alive = true;
    setLoading(true);
    setError(false);

    fetchDeliveries()
      .then((data) => {
        if (!alive) return;
        setItems(data);
      })
      .catch(() => {
        if (!alive) return;
        setItems([]);
        setError(true);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [active]);

  const counts = useMemo(() => {
    const base: Record<StatusFilter, number> = {
      ALL: items.length,
      ASSIGNED: 0,
      PICKED_UP: 0,
      ON_THE_WAY: 0,
      DELIVERED: 0,
      FAILED: 0,
    };

    for (const d of items) {
      const key = statusKey(d.status);
      if (key !== "UNKNOWN") base[key] += 1;
    }

    return base;
  }, [items]);

  const filtered = useMemo(() => {
    if (filter === "ALL") return items;
    return items.filter((d) => (d.status || "").toUpperCase() === filter);
  }, [items, filter]);

  return (
    <section id="screen-deliveries" className={`screen ${active ? "active" : ""}`}>
      <SecondaryTopbar onBurger={onBurger} onNotifications={onOpenNotifications} notificationCount={notificationCount} />

      <header className="simple-header">
        <div className="simple-title">Доставки</div>
      </header>

      <div className="deliveries-filters">
        {STATUSES.map((s) => (
          <button
            key={s}
            className={`filter-btn ${filter === s ? "active" : ""}`}
            type="button"
            onClick={() => setFilter(s)}
          >
            {`${filterLabel(s)} (${counts[s] ?? 0})`}
          </button>
        ))}
      </div>

      <div className="deliveries-list">
        {loading ? (
          <div className="deliveries-empty">Загружаем доставки...</div>
        ) : error ? (
          <div className="deliveries-empty">Не удалось получить доставки</div>
        ) : filtered.length === 0 ? (
          <div className="deliveries-empty">
            {filter === "ALL" ? "Пока доставок нет" : "Нет доставок по фильтру"}
          </div>
        ) : (
          filtered.map((d) => {
            const key = statusKey(d.status);
            const statusClass = `delivery-status delivery-status--${key.toLowerCase()}`;
            return (
              <div className="delivery-card" key={d.id}>
                <div className="delivery-row">
                  <div className="delivery-title">USC-{d.order_id}</div>
                  <div className={statusClass}>{statusLabel(d.status)}</div>
                </div>
                <div className="delivery-meta">
                  {d.tracking_link ? (
                    <a className="order-item-link" href={d.tracking_link} target="_blank" rel="noreferrer">
                      Трек-ссылка
                    </a>
                  ) : (
                    <span className="order-item-muted">Без трек-ссылки</span>
                  )}
                </div>
                <div className="delivery-actions">
                  <select
                    className="order-status-select"
                    defaultValue={d.status ?? "ASSIGNED"}
                    onChange={async (e) => {
                      const next = e.target.value;
                      try {
                        const updated = await setDeliveryStatus(d.id, next);
                        setItems((prev) => prev.map((x) => (x.id === d.id ? updated : x)));
                      } catch {
                        // ignore
                      }
                    }}
                  >
                    <option value="ASSIGNED">Назначена</option>
                    <option value="PICKED_UP">Забран</option>
                    <option value="ON_THE_WAY">В пути</option>
                    <option value="DELIVERED">Доставлен</option>
                    <option value="FAILED">Срыв</option>
                  </select>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
