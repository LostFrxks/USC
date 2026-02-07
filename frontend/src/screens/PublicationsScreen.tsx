import { useMemo, useState } from "react";
import SecondaryTopbar from "../ui/SecondaryTopbar";

type PublicationStatus = "active" | "draft" | "archive";

type Publication = {
  id: number;
  title: string;
  subtitle: string;
  image: string;
  status: PublicationStatus;
  rating: number;
  reviews: number;
  updatedAt: string;
  views: number;
  leads: number;
  favorite: boolean;
};

const initialPublications: Publication[] = [
  {
    id: 1,
    title: "Мраморная говядина · опт от 20 кг",
    subtitle: "Премиум сегмент · стабильная поставка",
    image: "/media/card_meat1.jpg",
    status: "active",
    rating: 4.9,
    reviews: 85,
    updatedAt: "сегодня, 11:20",
    views: 1240,
    leads: 34,
    favorite: false,
  },
  {
    id: 2,
    title: "Лосось охлажденный для ресторанов",
    subtitle: "Холодовая цепь · 24 часа доставка",
    image: "/media/card_fish2.jpg",
    status: "draft",
    rating: 4.7,
    reviews: 31,
    updatedAt: "вчера, 19:40",
    views: 620,
    leads: 12,
    favorite: true,
  },
  {
    id: 3,
    title: "Хлеб и выпечка для кофеен",
    subtitle: "Свежая выпечка · ежедневные поставки",
    image: "/media/card_bread3.jpg",
    status: "archive",
    rating: 4.8,
    reviews: 56,
    updatedAt: "12 янв, 09:15",
    views: 980,
    leads: 21,
    favorite: false,
  },
  {
    id: 4,
    title: "Молоко 3.2% в tetra-pack",
    subtitle: "SKU для retail и HoReCa",
    image: "/media/card_milk1.jpg",
    status: "active",
    rating: 4.6,
    reviews: 44,
    updatedAt: "сегодня, 08:50",
    views: 860,
    leads: 19,
    favorite: false,
  },
];

const statusLabel: Record<PublicationStatus, string> = {
  active: "Активно",
  draft: "Черновик",
  archive: "Архив",
};

const statusClass: Record<PublicationStatus, string> = {
  active: "publication-status publication-status--active",
  draft: "publication-status publication-status--draft",
  archive: "publication-status publication-status--archive",
};

export default function PublicationsScreen({
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
  const [items, setItems] = useState<Publication[]>(initialPublications);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | PublicationStatus>("all");
  const [selectedId, setSelectedId] = useState<number>(initialPublications[0].id);
  const [banner, setBanner] = useState<string>("Публикации готовы к продвижению");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const byFilter = filter === "all" ? true : item.status === filter;
      const byQuery = !q ? true : item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q);
      return byFilter && byQuery;
    });
  }, [items, query, filter]);

  const selected = visible.find((x) => x.id === selectedId) ?? visible[0] ?? null;

  const totalViews = items.reduce((sum, item) => sum + item.views, 0);
  const totalLeads = items.reduce((sum, item) => sum + item.leads, 0);
  const activeCount = items.filter((x) => x.status === "active").length;

  const updateItem = (id: number, patch: Partial<Publication>) => {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const cycleStatus = (id: number, current: PublicationStatus) => {
    const next: PublicationStatus = current === "active" ? "archive" : current === "archive" ? "draft" : "active";
    updateItem(id, { status: next });
    setBanner(`Статус изменен: ${statusLabel[next]}`);
  };

  return (
    <section id="screen-publications" className={`screen ${active ? "active" : ""}`}>
      <SecondaryTopbar onBurger={onBurger} onNotifications={onOpenNotifications} notificationCount={notificationCount} />

      <header className="simple-header">
        <div className="simple-title">Ваши публикации</div>
      </header>

      <div className="publications-hero">
        <div>
          <div className="publications-hero-title">Витрина поставщика</div>
          <div className="publications-hero-sub">Активных карточек: {activeCount}</div>
        </div>
        <button className="publications-hero-btn" type="button" onClick={() => setBanner("Новая публикация добавлена в черновики")}>
          + Создать
        </button>
      </div>

      <div className="publications-stats">
        <div className="publication-kpi">
          <div className="publication-kpi-label">Показы</div>
          <div className="publication-kpi-value">{totalViews.toLocaleString("ru-RU")}</div>
        </div>
        <div className="publication-kpi">
          <div className="publication-kpi-label">Лиды</div>
          <div className="publication-kpi-value">{totalLeads}</div>
        </div>
        <div className="publication-kpi">
          <div className="publication-kpi-label">Конверсия</div>
          <div className="publication-kpi-value">{totalViews ? `${Math.round((totalLeads / totalViews) * 100)}%` : "0%"}</div>
        </div>
      </div>

      <div className="publications-banner">{banner}</div>

      <div className="search-box publications-search">
        <span>🔎</span>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по названию или нише" />
        {query && (
          <button className="clear-search" type="button" onClick={() => setQuery("")}>
            ×
          </button>
        )}
      </div>

      <div className="publications-filters">
        {[
          { key: "all", label: "Все" },
          { key: "active", label: "Активные" },
          { key: "draft", label: "Черновики" },
          { key: "archive", label: "Архив" },
        ].map((chip) => (
          <button
            key={chip.key}
            type="button"
            className={`filter-btn ${filter === chip.key ? "active" : ""}`}
            onClick={() => setFilter(chip.key as "all" | PublicationStatus)}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="publications-list">
        {visible.length === 0 && (
          <div className="publications-empty">
            <div className="publications-empty-title">Ничего не найдено</div>
            <div className="publications-empty-text">Попробуй изменить фильтр или строку поиска.</div>
          </div>
        )}

        {visible.map((item) => {
          const expanded = selected?.id === item.id;
          return (
            <article
              key={item.id}
              className={`publication-card publication-card--interactive ${expanded ? "is-selected" : ""}`}
              onClick={() => setSelectedId(item.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setSelectedId(item.id);
              }}
            >
              <img src={item.image} alt={item.title} className="publication-image" />
              <div className="publication-body">
                <div className="publication-head">
                  <div className={statusClass[item.status]}>{statusLabel[item.status]}</div>
                  <button
                    className={`publication-favorite ${item.favorite ? "active" : ""}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateItem(item.id, { favorite: !item.favorite });
                    }}
                  >
                    {item.favorite ? "★" : "☆"}
                  </button>
                </div>

                <div className="publication-title">{item.title}</div>
                <div className="publication-subtitle">{item.subtitle}</div>
                <div className="publication-meta">
                  {item.rating.toFixed(1)} ★ · {item.reviews} оценок · обновлено {item.updatedAt}
                </div>

                <div className="publication-metrics">
                  <span>Показы: {item.views}</span>
                  <span>Лиды: {item.leads}</span>
                </div>

                {expanded && (
                  <div className="publication-actions">
                    <button
                      type="button"
                      className="publication-action"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateItem(item.id, { views: item.views + 27, leads: item.leads + 1 });
                        setBanner("Продвижение включено: +27 показов");
                      }}
                    >
                      Продвинуть
                    </button>
                    <button
                      type="button"
                      className="publication-action publication-action--ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        cycleStatus(item.id, item.status);
                      }}
                    >
                      Сменить статус
                    </button>
                    <button
                      type="button"
                      className="publication-action publication-action--ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setBanner(`Открыт редактор: "${item.title}"`);
                      }}
                    >
                      Редактировать
                    </button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
