import { useOrders } from "../hooks/useOrders";

export default function OrdersOverlay({
  active,
  cartCount,
  onBack,
}: {
  active: boolean;
  cartCount: number;
  onBack: () => void;
}) {
  const { loading, orders, apiOk, reload } = useOrders(active);

  return (
    <section id="screen-orders" className={`screen ${active ? "active" : ""}`}>
      <div className="topbar">
        <button type="button" className="burger" onClick={onBack} aria-label="Назад" title="Назад">
          ←
        </button>

        <div className="topbar-title" style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 900, fontSize: 14 }}>Заказы</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            {loading ? "Загружаю..." : `${orders.length} заказов`}
          </div>
        </div>

        <div className="topbar-badge" title="Корзина">
          🛒 <span style={{ fontWeight: 900 }}>{cartCount}</span>
        </div>
      </div>

      <div className="search-card">
        <div className="search-top">
          <div className="search-title-row">
            <div className="search-title">История</div>
            <button type="button" className="chip chip-reset" onClick={reload}>
              Обновить
            </button>
          </div>
          <div className="search-meta">{loading ? "Сканирую..." : "Готово"}</div>
        </div>

        <div className="search-card-body">
          {!apiOk ? (
            <div className="search-empty">
              <div className="search-empty-title">Заказы недоступны</div>
              <div className="search-empty-text">
                Нужен endpoint <b>/api/orders/</b>. Сейчас фронт его вызывает.
              </div>
            </div>
          ) : loading ? (
            <div className="search-empty">
              <div className="search-empty-title">Загрузка...</div>
              <div className="search-empty-text">Сейчас подтянем список заказов.</div>
            </div>
          ) : orders.length === 0 ? (
            <div className="search-empty">
              <div className="search-empty-title">Пока нет заказов</div>
              <div className="search-empty-text">Создай первый заказ из корзины.</div>
            </div>
          ) : (
            <div className="supplier-list">
              {orders.map((o) => (
                <div key={String(o.id)} className="supplier-card">
                  <div className="supplier-left">
                    <div className="supplier-logo">
                      <img src="/media/usc.svg" alt="" />
                    </div>
                    <div className="supplier-meta">
                      <div className="supplier-name">Заказ #{String(o.id)}</div>
                      <div className="supplier-sub">
                        {o.status ?? "PENDING"} • {o.itemsCount ?? "—"} позиций • {o.total ?? "—"} сом
                      </div>
                    </div>
                  </div>

                  <button type="button" className="supplier-open" disabled>
                    Детали
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
