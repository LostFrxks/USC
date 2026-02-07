import TopHeader from "../ui/TopHeader";
import type { MeProfile } from "../api/profile";

function roleLabel(role?: string | null): string {
  const r = (role || "").toLowerCase();
  if (r === "supplier") return "\u041f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a";
  if (r === "buyer") return "\u041f\u043e\u043a\u0443\u043f\u0430\u0442\u0435\u043b\u044c";
  return "\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c";
}

function companyTypeLabel(companyType?: string | null): string {
  const t = (companyType || "").toUpperCase();
  if (t === "SUPPLIER") return "\u041f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a";
  if (t === "BUYER") return "\u041f\u043e\u043a\u0443\u043f\u0430\u0442\u0435\u043b\u044c";
  return "Company";
}

export default function ProfileScreen({
  active,
  cartCount,
  onBurger,
  profile,
  companyName,
  onSwitchCompany,
  showCompanyBanner = false,
  onPickCompany,
}: {
  active: boolean;
  cartCount: number;
  onBurger: () => void;
  profile: MeProfile | null;
  companyName?: string | null;
  onSwitchCompany: () => void;
  showCompanyBanner?: boolean;
  onPickCompany?: () => void;
}) {
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
  const displayName = fullName || profile?.email || "USC user";
  const displayEmail = profile?.email || "\u2014";
  const displayPhone = profile?.phone || "\u2014";
  const roleText = roleLabel(profile?.role);
  const companies = profile?.companies ?? [];
  const companiesCount = companies.length;
  const courierEnabled = profile?.is_courier_enabled ? "\u0414\u0430" : "\u041d\u0435\u0442";
  const currentCompany = companyName || "\u041d\u0435 \u0432\u044b\u0431\u0440\u0430\u043d\u0430";

  return (
    <section id="screen-profile" className={`screen ${active ? "active" : ""}`}>
      <TopHeader onBurger={onBurger} badgeCount={cartCount} />

      <header className="simple-header">
        <div className="simple-title">{"\u041f\u0440\u043e\u0444\u0438\u043b\u044c"}</div>
      </header>

      {showCompanyBanner ? (
        <div className="company-banner">
          <div>
            <div className="company-banner-title">{"\u0414\u043e\u0431\u0430\u0432\u044c \u043a\u043e\u043c\u043f\u0430\u043d\u0438\u044e"}</div>
            <div className="company-banner-text">
              {"\u0411\u0435\u0437 \u043a\u043e\u043c\u043f\u0430\u043d\u0438\u0438 \u0431\u0443\u0434\u0435\u0442 \u043e\u0433\u0440\u0430\u043d\u0438\u0447\u0435\u043d \u0437\u0430\u043a\u0430\u0437 \u0438 \u0430\u043d\u0430\u043b\u0438\u0442\u0438\u043a\u0430."}
            </div>
          </div>
          <button className="company-banner-btn" type="button" onClick={onPickCompany}>
            {"\u0412\u044b\u0431\u0440\u0430\u0442\u044c"}
          </button>
        </div>
      ) : null}

      <div className="profilev2-card">
        <div className="profilev2-hero">
          <div className="profilev2-avatar">
            <img src="/media/ava_burger.svg" alt={"\u0410\u0432\u0430\u0442\u0430\u0440"} />
          </div>

          <div className="profilev2-main">
            <div className="profilev2-name">{displayName}</div>
            <div className="profilev2-email">{displayEmail}</div>
            <div className="profilev2-role-chip">{roleText}</div>
          </div>
        </div>

        <div className="profilev2-actions">
          <button className="profilev2-action-btn profilev2-action-primary" type="button" onClick={onSwitchCompany}>
            {"\u0421\u043c\u0435\u043d\u0438\u0442\u044c \u043a\u043e\u043c\u043f\u0430\u043d\u0438\u044e"}
          </button>
        </div>

        <div className="profilev2-stats">
          <div className="profilev2-stat">
            <div className="profilev2-stat-value">{companiesCount}</div>
            <div className="profilev2-stat-label">{"\u041a\u043e\u043c\u043f\u0430\u043d\u0438\u0439"}</div>
          </div>
          <div className="profilev2-stat">
            <div className="profilev2-stat-value">{courierEnabled}</div>
            <div className="profilev2-stat-label">{"\u041a\u0443\u0440\u044c\u0435\u0440"}</div>
          </div>
          <div className="profilev2-stat">
            <div className="profilev2-stat-value profilev2-stat-company">{currentCompany}</div>
            <div className="profilev2-stat-label">{"\u0410\u043a\u0442\u0438\u0432\u043d\u0430\u044f \u043a\u043e\u043c\u043f\u0430\u043d\u0438\u044f"}</div>
          </div>
        </div>

        <div className="profilev2-section">
          <div className="profilev2-section-title">{"\u0412\u0430\u0448\u0438 \u043a\u043e\u043c\u043f\u0430\u043d\u0438\u0438"}</div>
          <div className="profilev2-list">
            {companies.length === 0 ? (
              <div className="profilev2-row">
                <div className="profilev2-row-main">
                  <div className="profilev2-row-title">{"\u041d\u0435\u0442 \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b\u0445 \u043a\u043e\u043c\u043f\u0430\u043d\u0438\u0439"}</div>
                </div>
                <div className="profilev2-row-side">\u2014</div>
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
          <div className="profilev2-section-title">{"\u041a\u043e\u043d\u0442\u0430\u043a\u0442\u044b"}</div>
          <div className="profilev2-list">
            <div className="profilev2-row">
              <div className="profilev2-row-main">
                <div className="profilev2-row-title">Email</div>
              </div>
              <div className="profilev2-row-side">{displayEmail}</div>
            </div>
            <div className="profilev2-row">
              <div className="profilev2-row-main">
                <div className="profilev2-row-title">{"\u0422\u0435\u043b\u0435\u0444\u043e\u043d"}</div>
              </div>
              <div className="profilev2-row-side">{displayPhone}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="profile-bottom-pad" />
    </section>
  );
}
