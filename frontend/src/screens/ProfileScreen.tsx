import TopHeader from "../ui/TopHeader";
import type { MeProfile } from "../api/profile";

function roleLabel(role?: string | null): string {
  const r = (role || "").toLowerCase();
  if (r === "supplier") return "Поставщик";
  if (r === "buyer") return "Покупатель";
  return "Пользователь";
}

function companyTypeLabel(companyType?: string | null): string {
  const t = (companyType || "").toUpperCase();
  if (t === "SUPPLIER") return "Поставщик";
  if (t === "BUYER") return "Покупатель";
  return "Company";
}

export default function ProfileScreen({
  active,
  cartCount,
  onBurger,
  profile,
  role,
  companyName,
  onSwitchCompany,
  showCompanyBanner = false,
  onPickCompany,
  completedOrders = 0,
}: {
  active: boolean;
  cartCount: number;
  onBurger: () => void;
  profile: MeProfile | null;
  role?: string | null;
  companyName?: string | null;
  onSwitchCompany: () => void;
  showCompanyBanner?: boolean;
  onPickCompany?: () => void;
  completedOrders?: number;
}) {
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
  const displayName = fullName || profile?.email || "USC user";
  const displayEmail = profile?.email || "—";
  const displayPhone = profile?.phone || "—";
  const roleText = roleLabel(role ?? profile?.role);
  const companies = profile?.companies ?? [];
  const companiesCount = companies.length;
  const courierEnabled = profile?.is_courier_enabled ? "Да" : "Нет";
  const currentCompany = companyName || "Не выбрана";

  return (
    <section id="screen-profile" className={`screen ${active ? "active" : ""}`}>
      <TopHeader onBurger={onBurger} badgeCount={cartCount} />

      <header className="simple-header">
        <div className="simple-title">Профиль</div>
      </header>

      {showCompanyBanner ? (
        <div className="company-banner">
          <div>
            <div className="company-banner-title">Добавь компанию</div>
            <div className="company-banner-text">Без компании будет ограничен заказ и аналитика.</div>
          </div>
          <button className="company-banner-btn" type="button" onClick={onPickCompany}>
            Выбрать
          </button>
        </div>
      ) : null}

      <div className="profilev2-card">
        <div className="profilev2-hero">
          <div className="profilev2-avatar">
            <img src="/media/ava_burger.svg" alt="Аватар" />
          </div>

          <div className="profilev2-main">
            <div className="profilev2-name">{displayName}</div>
            <div className="profilev2-email">{displayEmail}</div>
            <div className="profilev2-role-chip">{roleText}</div>
            <div className="profilev2-rating-text">Роль и активная компания определяют текущий рабочий режим.</div>
          </div>
        </div>

        <div className="profilev2-actions">
          <button
            className="profilev2-action-btn profilev2-action-primary"
            data-tour-id="profile-switch-company"
            type="button"
            onClick={onSwitchCompany}
          >
            Сменить компанию
          </button>
        </div>

        <div className="profilev2-stats">
          <div className="profilev2-stat">
            <div className="profilev2-stat-value">{roleText}</div>
            <div className="profilev2-stat-label">Режим</div>
          </div>
          <div className="profilev2-stat">
            <div className="profilev2-stat-value">{courierEnabled}</div>
            <div className="profilev2-stat-label">Курьер</div>
          </div>
          <div className="profilev2-stat">
            <div className="profilev2-stat-value">{companiesCount}</div>
            <div className="profilev2-stat-label">Компаний</div>
          </div>
          <div className="profilev2-stat">
            <div className="profilev2-stat-value">{completedOrders}</div>
            <div className="profilev2-stat-label">Завершено</div>
          </div>
        </div>

        <div className="profilev2-company-strip">
          <span className="profilev2-company-title">Активная компания</span>
          <span className="profilev2-company-name">{currentCompany}</span>
          <span className="profilev2-company-meta">{`Курьер: ${courierEnabled}`}</span>
        </div>

        <div className="profilev2-section">
          <div className="profilev2-section-title">Ваши компании</div>
          <div className="profilev2-list">
            {companies.length === 0 ? (
              <div className="profilev2-row">
                <div className="profilev2-row-main">
                  <div className="profilev2-row-title">Нет доступных компаний</div>
                </div>
                <div className="profilev2-row-side">—</div>
              </div>
            ) : (
              companies.map((c) => (
                <div className="profilev2-row" key={c.company_id}>
                  <div className="profilev2-row-main">
                    <div className="profilev2-row-title">{c.name}</div>
                    <div className="profilev2-row-sub">{`ID: ${c.company_id}`}</div>
                  </div>
                  <div className="profilev2-row-side">{companyTypeLabel(c.company_type)}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="profilev2-section">
          <div className="profilev2-section-title">Контакты</div>
          <div className="profilev2-list">
            <div className="profilev2-row">
              <div className="profilev2-row-main">
                <div className="profilev2-row-title">Email</div>
              </div>
              <div className="profilev2-row-side">{displayEmail}</div>
            </div>
            <div className="profilev2-row">
              <div className="profilev2-row-main">
                <div className="profilev2-row-title">Телефон</div>
              </div>
              <div className="profilev2-row-side">{displayPhone}</div>
            </div>
          </div>
        </div>
      </div>

    </section>
  );
}
