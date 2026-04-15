import { useEffect, useMemo, useState } from "react";
import {
  cancelOrder,
  createOrder,
  fetchOrderDetail,
  supplierConfirmOrder,
  type Order,
} from "../api/orders";
import { fetchDeliveryByOrder, setDeliveryStatus, type Delivery } from "../api/deliveries";
import type { ToastTone } from "../hooks/useToast";
import { useOrders } from "../hooks/useOrders";
import OrderModal from "../ui/OrderModal";
import SecondaryTopbar from "../ui/SecondaryTopbar";
import { parseGeoTag, stripGeoTag, toOsmLink } from "../utils/geo";

const JOURNEY_STEPS = ["Создан", "Подтвержден", "В пути", "Доставлен"] as const;
type OrderFilter = "all" | "active" | "delivered" | "cancelled";

function statusLabel(s: string) {
  switch (s) {
    case "created":
      return "Создан";
    case "confirmed":
      return "Подтвержден";
    case "delivering":
      return "В пути";
    case "delivered":
      return "Доставлен";
    case "canceled":
    case "cancelled":
      return "Отменен";
    default:
      return s;
  }
}

function statusTone(s: string) {
  switch (s) {
    case "delivered":
      return "success";
    case "delivering":
    case "confirmed":
    case "created":
      return "progress";
    case "canceled":
    case "cancelled":
      return "canceled";
    default:
      return "progress";
  }
}

function statusIndex(s: string) {
  switch (s) {
    case "created":
      return 0;
    case "confirmed":
      return 1;
    case "delivering":
      return 2;
    case "delivered":
      return 3;
    default:
      return -1;
  }
}

function deliveryStatusLabel(status?: string | null) {
  switch ((status || "").toUpperCase()) {
    case "ASSIGNED":
      return "Назначена";
    case "PICKED_UP":
      return "Забран";
    case "ON_THE_WAY":
      return "В пути";
    case "DELIVERED":
      return "Доставлена";
    case "FAILED":
      return "Срыв";
    default:
      return status || "?";
  }
}

function deliveryStatusKey(status?: string | null) {
  switch ((status || "").toUpperCase()) {
    case "ASSIGNED":
      return "assigned";
    case "PICKED_UP":
      return "picked_up";
    case "ON_THE_WAY":
      return "on_the_way";
    case "DELIVERED":
      return "delivered";
    case "FAILED":
      return "failed";
    default:
      return "unknown";
  }
}

function formatDate(x?: string | null) {
  if (!x) return "";
  const d = new Date(x);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function sumFromItems(order: Order): number | null {
  if (!order.items?.length) return null;
  let total = 0;
  for (const it of order.items) {
    const p = it.priceSnapshot ?? null;
    if (typeof p === "number") total += p * it.qty;
  }
  return total > 0 ? total : null;
}

function isCancelledStatus(status: string): boolean {
  return status === "canceled" || status === "cancelled";
}

function isActiveStatus(status: string): boolean {
  return ["created", "confirmed", "delivering"].includes(status);
}

function nextStepHint(order: Order, roleLower: string): string {
  if (isCancelledStatus(order.status)) return "Заказ отменен";
  if (order.status === "created") {
    return roleLower === "supplier" ? "Нужно подтвердить заказ" : "Ждем подтверждение поставщика";
  }
  if (order.status === "confirmed") return "Заказ в работе, готовится отгрузка";
  if (order.status === "delivering") return "Отслеживайте доставку в статусе заказа";
  if (order.status === "delivered") return "Заказ завершен";
  return "Следите за обновлениями статуса";
}

export default function OrdersScreen({
  active,
  cartCount,
  onBurger,
  onOpenNotifications,
  notificationCount,
  onBack,
  buyerCompanyId,
  role,
  focusOrderId,
  onFocusOrderHandled,
  onNotify,
}: {
  active: boolean;
  cartCount: number;
  onBurger: () => void;
  onOpenNotifications?: () => void;
  notificationCount?: number;
  onBack?: () => void;
  buyerCompanyId?: number | null;
  role?: string | null;
  focusOrderId?: number | null;
  onFocusOrderHandled?: () => void;
  onNotify: (message: string, tone?: ToastTone) => void;
}) {
  void cartCount;
  void onBack;

  const roleLower = (role || "").toLowerCase();
  const [mode, setMode] = useState<"buyer" | "inbox" | "outbox">(roleLower === "supplier" ? "inbox" : "buyer");

  useEffect(() => {
    if (roleLower === "supplier") {
      setMode((prev) => (prev === "outbox" || prev === "inbox" ? prev : "inbox"));
    } else {
      setMode("buyer");
    }
  }, [roleLower]);

  const { loading, orders, apiOk, reload } = useOrders(active, {
    buyerCompanyId: buyerCompanyId ?? null,
    source: mode,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selected, setSelected] = useState<Order | null>(null);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [deliveryError, setDeliveryError] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [quickBusyId, setQuickBusyId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrderFilter>("all");
  const [actionNote, setActionNote] = useState<{ tone: "info" | "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    setStatusFilter("all");
  }, [mode, roleLower]);

  const openDetails = async (o: Order) => {
    setSelected(o);
    setModalOpen(true);
    setActionNote(null);
    setDelivery(o.delivery ? { ...o.delivery, order_id: o.id } : null);
    setDeliveryError(false);

    setDetailLoading(true);
    const detail = await fetchOrderDetail(o.id, mode === "buyer" ? buyerCompanyId ?? undefined : undefined);
    if (detail) setSelected(detail);
    setDetailLoading(false);

    setDeliveryLoading(true);
    fetchDeliveryByOrder(o.id)
      .then((d) => {
        setDelivery(d);
        setDeliveryError(false);
      })
      .catch(() => {
        setDelivery(null);
        setDeliveryError(true);
      })
      .finally(() => setDeliveryLoading(false));
  };

  const canSupplierConfirm = useMemo(() => {
    if (!selected) return false;
    return roleLower === "supplier" && selected.status === "created";
  }, [selected, roleLower]);

  const canCancel = useMemo(() => {
    if (!selected) return false;
    return ["created", "confirmed", "delivering"].includes(selected.status);
  }, [selected]);

  const canRepeatOrder = useMemo(() => {
    if (!selected || roleLower === "supplier") return false;
    return Boolean(selected.items?.length && buyerCompanyId && selected.supplierCompanyId);
  }, [selected, roleLower, buyerCompanyId]);

  const handleSupplierConfirm = async () => {
    if (!selected || actionBusy) return;
    setActionBusy(true);
    setActionNote(null);
    try {
      const updated = await supplierConfirmOrder(selected.id);
      setSelected(updated);
      if (updated.delivery) setDelivery({ ...updated.delivery, order_id: updated.id });
      setActionNote({ tone: "success", text: "Заказ подтвержден поставщиком" });
      onNotify(`Заказ USC-${updated.id} подтвержден`, "success");
      reload();
    } catch {
      setActionNote({ tone: "error", text: "Не удалось подтвердить заказ" });
      onNotify("Не удалось подтвердить заказ", "error");
    } finally {
      setActionBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!selected || actionBusy) return;
    setActionBusy(true);
    setActionNote(null);
    try {
      const updated = await cancelOrder(selected.id);
      setSelected(updated);
      if (updated.delivery) setDelivery({ ...updated.delivery, order_id: updated.id });
      setActionNote({ tone: "success", text: "Заказ отменен" });
      onNotify(`Заказ USC-${updated.id} отменен`, "success");
      reload();
    } catch {
      setActionNote({ tone: "error", text: "Не удалось отменить заказ" });
      onNotify("Не удалось отменить заказ", "error");
    } finally {
      setActionBusy(false);
    }
  };

  const handleRepeatOrder = async () => {
    if (!selected || !canRepeatOrder || actionBusy) return;
    setActionBusy(true);
    setActionNote(null);
    try {
      await createOrder({
        buyer_company_id: Number(buyerCompanyId),
        supplier_company_id: Number(selected.supplierCompanyId),
        delivery_address: "Повтор заказа",
        comment: `Повтор заказа USC-${selected.id}`,
        delivery_mode: "SUPPLIER_COURIER",
        items: (selected.items || []).map((it) => ({
          product_id: it.productId,
          qty: it.qty,
        })),
      });
      setActionNote({ tone: "success", text: `Новый заказ создан на базе USC-${selected.id}` });
      onNotify(`Новый заказ создан на базе USC-${selected.id}`, "success");
      reload();
    } catch {
      setActionNote({ tone: "error", text: "Не удалось повторить заказ" });
      onNotify("Не удалось повторить заказ", "error");
    } finally {
      setActionBusy(false);
    }
  };

  const handleQuickSupplierConfirm = async (order: Order) => {
    if (quickBusyId != null) return;
    setQuickBusyId(order.id);
    try {
      const updated = await supplierConfirmOrder(order.id);
      if (selected?.id === updated.id) setSelected(updated);
      onNotify(`Заказ USC-${updated.id} подтвержден`, "success");
      reload();
    } catch {
      onNotify("Не удалось подтвердить заказ", "error");
    } finally {
      setQuickBusyId(null);
    }
  };

  const handleQuickRepeat = async (order: Order) => {
    if (quickBusyId != null) return;
    if (!buyerCompanyId) {
      onNotify("Выберите компанию покупателя", "error");
      return;
    }
    setQuickBusyId(order.id);
    try {
      const detail = await fetchOrderDetail(order.id, buyerCompanyId);
      if (!detail?.items?.length || !detail.supplierCompanyId) {
        onNotify("Не удалось подготовить повтор заказа", "error");
        return;
      }
      await createOrder({
        buyer_company_id: Number(buyerCompanyId),
        supplier_company_id: Number(detail.supplierCompanyId),
        delivery_address: "Повтор заказа",
        comment: `Повтор заказа USC-${order.id}`,
        delivery_mode: "SUPPLIER_COURIER",
        items: detail.items.map((it) => ({
          product_id: it.productId,
          qty: it.qty,
        })),
      });
      onNotify(`Создан повтор заказа USC-${order.id}`, "success");
      reload();
    } catch {
      onNotify("Не удалось повторить заказ", "error");
    } finally {
      setQuickBusyId(null);
    }
  };

  useEffect(() => {
    if (!active || !focusOrderId) return;
    const existing = orders.find((o) => o.id === focusOrderId);
    if (existing) {
      void openDetails(existing);
      onFocusOrderHandled?.();
      return;
    }

    void openDetails({
      id: focusOrderId,
      status: "created",
      createdAt: null,
      comment: null,
      itemsCount: null,
      total: null,
      items: [],
      buyerCompanyId: null,
      supplierCompanyId: null,
      delivery: null,
    });
    onFocusOrderHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, focusOrderId, orders]);

  const tryReload = () => {
    if (loading) return;
    reload();
  };

  const orderedList = useMemo(() => {
    const rows = [...orders];
    rows.sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (da !== db) return db - da;
      return b.id - a.id;
    });
    return rows;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (statusFilter === "all") return orderedList;
    if (statusFilter === "active") return orderedList.filter((o) => isActiveStatus(o.status));
    if (statusFilter === "delivered") return orderedList.filter((o) => o.status === "delivered");
    return orderedList.filter((o) => isCancelledStatus(o.status));
  }, [orderedList, statusFilter]);

  const filterCounts = useMemo(() => {
    const activeCount = orderedList.filter((o) => isActiveStatus(o.status)).length;
    const deliveredCount = orderedList.filter((o) => o.status === "delivered").length;
    const cancelledCount = orderedList.filter((o) => isCancelledStatus(o.status)).length;
    return {
      all: orderedList.length,
      active: activeCount,
      delivered: deliveredCount,
      cancelled: cancelledCount,
    };
  }, [orderedList]);
  const selectedGeo =
    selected?.deliveryLat != null && selected?.deliveryLng != null
      ? { lat: selected.deliveryLat, lng: selected.deliveryLng }
      : selected
        ? parseGeoTag(selected.comment)
        : null;

  return (
    <section id="screen-orders" data-testid="screen-orders" className={`screen ${active ? "active" : ""}`}>
      <SecondaryTopbar onBurger={onBurger} onNotifications={onOpenNotifications} notificationCount={notificationCount} />

      <header className="simple-header">
        <div className="simple-title">История заказов</div>
      </header>

      {roleLower === "supplier" && (
        <div className="segmented">
          <button className={`seg-btn ${mode === "inbox" ? "active" : ""}`} type="button" onClick={() => setMode("inbox")}>
            Входящие
          </button>
          <button className={`seg-btn ${mode === "outbox" ? "active" : ""}`} type="button" onClick={() => setMode("outbox")}>
            Исходящие
          </button>
        </div>
      )}

      {orders.length > 0 && (
        <div className="orders-filters">
          <button
            className={`orders-filter-btn ${statusFilter === "all" ? "active" : ""}`}
            type="button"
            onClick={() => setStatusFilter("all")}
          >
            Все ({filterCounts.all})
          </button>
          <button
            className={`orders-filter-btn ${statusFilter === "active" ? "active" : ""}`}
            type="button"
            onClick={() => setStatusFilter("active")}
          >
            Активные ({filterCounts.active})
          </button>
          <button
            className={`orders-filter-btn ${statusFilter === "delivered" ? "active" : ""}`}
            type="button"
            onClick={() => setStatusFilter("delivered")}
          >
            Доставлены ({filterCounts.delivered})
          </button>
          <button
            className={`orders-filter-btn ${statusFilter === "cancelled" ? "active" : ""}`}
            type="button"
            onClick={() => setStatusFilter("cancelled")}
          >
            Отменены ({filterCounts.cancelled})
          </button>
        </div>
      )}

      {mode === "buyer" && !buyerCompanyId ? (
        <div className="orders-empty">
          <div className="orders-empty-emoji">🏢</div>
          <div className="orders-empty-title">Нужна компания</div>
          <div className="orders-empty-text">Выберите компанию, чтобы посмотреть историю заказов.</div>
        </div>
      ) : !apiOk ? (
        <div className="orders-empty" onClick={tryReload}>
          <div className="orders-empty-emoji">🛠️</div>
          <div className="orders-empty-title">Не достучался до API</div>
          <div className="orders-empty-text">Проверь backend и Vite proxy, потом попробуй еще раз.</div>
        </div>
      ) : orders.length === 0 && loading ? (
        <div className="orders-empty">
          <div className="orders-empty-emoji">⏳</div>
          <div className="orders-empty-title">Загружаю историю</div>
          <div className="orders-empty-text">Сейчас подтяну список заказов.</div>
        </div>
      ) : orders.length === 0 ? (
        <div className="orders-empty">
          <div className="orders-empty-emoji">📦</div>
          <div className="orders-empty-title">Пока заказов нет</div>
          <div className="orders-empty-text">Сделай заказ из корзины - и он появится здесь.</div>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="orders-empty">
          <div className="orders-empty-emoji">🔎</div>
          <div className="orders-empty-title">По фильтру пусто</div>
          <div className="orders-empty-text">Сбрось фильтр и посмотри остальные заказы.</div>
        </div>
      ) : (
        <div className="orders-list">
          {filteredOrders.map((o) => {
            const date = formatDate(o.createdAt);
            const total = o.total ?? null;
            const totalFromItems = total ?? sumFromItems(o);
            const tone = statusTone(o.status);
            const isQuickBusy = quickBusyId === o.id;
            const canQuickConfirm = roleLower === "supplier" && mode === "inbox" && o.status === "created";
            const canQuickRepeat = roleLower !== "supplier" && mode === "buyer" && !isCancelledStatus(o.status);
            const itemsLabel =
              typeof o.itemsCount === "number" ? `Позиций: ${o.itemsCount}` : "Поставка USC";
            const metaParts = [date, stripGeoTag(o.comment)].filter(Boolean);
            const meta = metaParts.join(" · ");
            const hint = nextStepHint(o, roleLower);
            const geo =
              o.deliveryLat != null && o.deliveryLng != null
                ? { lat: o.deliveryLat, lng: o.deliveryLng }
                : parseGeoTag(o.comment);

            return (
              <div
                className="order-card"
                data-testid={`order-card-${o.id}`}
                key={o.id}
                role="button"
                tabIndex={0}
                onClick={() => openDetails(o)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") openDetails(o);
                }}
              >
                <div className="order-row">
                  <span className="order-id">USC-{o.id}</span>
                  <span className={`order-status ${tone}`}>{statusLabel(o.status)}</span>
                </div>
                <div className="order-row">
                  <span>{itemsLabel}</span>
                  <span>{totalFromItems ? `${Math.round(totalFromItems)} сом` : "-"}</span>
                </div>
                <div className="order-meta">{meta || "-"}</div>
                <div className="order-next-step">{hint}</div>
                {o.delivery?.status ? (
                  <div className="delivery-chip">
                    <span className={`delivery-status delivery-status--${deliveryStatusKey(o.delivery.status)}`}>
                      Доставка: {deliveryStatusLabel(o.delivery.status)}
                    </span>
                  </div>
                ) : null}

                <div className="order-card-actions">
                  <button
                    className="order-card-action-btn"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void openDetails(o);
                    }}
                  >
                    Подробнее
                  </button>

                  {canQuickConfirm && (
                    <button
                      className="order-card-action-btn order-card-action-btn-primary"
                      type="button"
                      disabled={isQuickBusy}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleQuickSupplierConfirm(o);
                      }}
                    >
                      {isQuickBusy ? "..." : "Подтвердить"}
                    </button>
                  )}

                  {canQuickRepeat && (
                    <button
                      className="order-card-action-btn order-card-action-btn-secondary"
                      type="button"
                      disabled={isQuickBusy}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleQuickRepeat(o);
                      }}
                    >
                      {isQuickBusy ? "..." : "Повторить"}
                    </button>
                  )}

                  {o.delivery?.tracking_link && (
                    <a
                      className="order-card-action-btn order-card-action-btn-link"
                      href={o.delivery.tracking_link}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Отследить
                    </a>
                  )}

                  {geo && (
                    <a
                      className="order-card-action-btn order-card-action-btn-link"
                      href={toOsmLink(geo)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Открыть точку
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <OrderModal
        open={modalOpen}
        loading={detailLoading || actionBusy}
        title={selected ? `Заказ #${selected.id}` : "Заказ"}
        onClose={() => setModalOpen(false)}
      >
        {!selected ? null : (
          <div className="order-detail">
            <div className="order-detail-row">
              <span>Статус</span>
              <b>{statusLabel(selected.status)}</b>
            </div>

            {selected.createdAt ? (
              <div className="order-detail-row">
                <span>Дата</span>
                <b>{formatDate(selected.createdAt)}</b>
              </div>
            ) : null}

            {selectedGeo ? (
              <div className="order-detail-row">
                <span>Точка доставки</span>
                <a
                  className="order-item-link"
                  href={toOsmLink(selectedGeo)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Открыть точку
                </a>
              </div>
            ) : null}

            <div className="order-journey">
              <div className="order-journey-title">Путь заказа</div>
              <div className="order-journey-steps">
                {JOURNEY_STEPS.map((step, idx) => {
                  const idxNow = statusIndex(selected.status);
                  const state =
                    idxNow >= 0 && idx < idxNow
                      ? "done"
                      : idxNow >= 0 && idx === idxNow
                        ? "current"
                        : "pending";
                  return (
                    <div className={`order-journey-step ${state}`} key={step}>
                      <div className="order-journey-dot">{idx + 1}</div>
                      <div className="order-journey-label">{step}</div>
                    </div>
                  );
                })}
              </div>
              {(selected.status === "canceled" || selected.status === "cancelled") && (
                <div className="order-action-note note-error">Заказ остановлен: статус "Отменен"</div>
              )}
            </div>

            {(canSupplierConfirm || canCancel || canRepeatOrder) && (
              <div className="order-actions">
                {canSupplierConfirm && (
                  <button className="order-action-btn order-action-btn-primary" type="button" onClick={handleSupplierConfirm}>
                    Подтвердить заказ
                  </button>
                )}
                {canCancel && (
                  <button className="order-action-btn order-action-btn-danger" type="button" onClick={handleCancel}>
                    Отменить заказ
                  </button>
                )}
                {canRepeatOrder && (
                  <button className="order-action-btn order-action-btn-secondary" type="button" onClick={handleRepeatOrder}>
                    Повторить заказ
                  </button>
                )}
              </div>
            )}

            {actionNote && (
              <div className={`order-action-note ${actionNote.tone === "error" ? "note-error" : actionNote.tone === "success" ? "note-success" : "note-info"}`}>
                {actionNote.text}
              </div>
            )}

            {selected.items?.length ? (
              <div className="order-items">
                <div className="order-items-title">Позиции</div>
                <div className="order-items-list">
                  {selected.items.map((it, idx) => (
                    <div className="order-item" key={`${it.productId}-${idx}`}>
                      <div className="order-item-left">
                        <div className="order-item-name">{it.name ?? `Товар #${it.productId}`}</div>
                        <div className="order-item-meta">Кол-во: {it.qty}</div>
                      </div>

                      <div className="order-item-right">
                        {typeof it.priceSnapshot === "number" ? <b>{Math.round(it.priceSnapshot)} сом</b> : <span className="order-item-muted">-</span>}
                      </div>
                    </div>
                  ))}
                </div>

                {sumFromItems(selected) ? (
                  <div className="order-detail-row order-detail-total">
                    <span>Итого</span>
                    <b>{Math.round(sumFromItems(selected) as number)} сом</b>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="modal-text">Детали позиций пока недоступны, но заказ создан.</div>
            )}

            <div className="order-items">
              <div className="order-items-title">Доставка</div>
              {deliveryLoading ? (
                <div className="order-item-muted">Загрузка доставки...</div>
              ) : deliveryError ? (
                <div className="order-item-muted">Не удалось загрузить доставку</div>
              ) : !delivery ? (
                <div className="order-item-muted">Доставка не назначена</div>
              ) : (
                <div className="order-items-list">
                  <div className="order-item">
                    <div className="order-item-left">
                      <div className="order-item-name">Текущий статус</div>
                      <div className="order-item-meta">
                        <span className={`delivery-status delivery-status--${deliveryStatusKey(delivery.status)}`}>
                          {deliveryStatusLabel(delivery.status)}
                        </span>
                      </div>
                    </div>
                    <div className="order-item-right">
                      {delivery.tracking_link ? (
                        <a className="order-item-link" href={delivery.tracking_link} target="_blank" rel="noreferrer">
                          Отследить
                        </a>
                      ) : (
                        <span className="order-item-muted">-</span>
                      )}
                    </div>
                  </div>

                  <div className="order-item">
                    <div className="order-item-left">
                      <div className="order-item-name">Сменить статус доставки</div>
                      <div className="order-item-meta">Доступно участникам заказа</div>
                    </div>
                    <div className="order-item-right">
                      <select
                        className="order-status-select"
                        value={(delivery.status || "").toUpperCase()}
                        onChange={async (e) => {
                          const next = e.target.value;
                          if (!delivery?.id) return;
                          try {
                            const updated = await setDeliveryStatus(delivery.id, next);
                            setDelivery(updated);
                            reload();
                          } catch {
                            setActionNote({ tone: "error", text: "Не удалось обновить статус доставки" });
                          }
                        }}
                      >
                        <option value="ASSIGNED">Назначена</option>
                        <option value="PICKED_UP">Забран</option>
                        <option value="ON_THE_WAY">В пути</option>
                        <option value="DELIVERED">Доставлена</option>
                        <option value="FAILED">Срыв</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </OrderModal>
    </section>
  );
}
