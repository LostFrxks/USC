import type { CompanyMembership, MeProfile } from "../api/profile";

function normalizeType(value?: string | null) {
  return (value || "").toLowerCase();
}

function filterCompanies(companies: CompanyMembership[], role?: string | null) {
  if (!role) return companies;
  const normalizedRole = role.toLowerCase();
  return companies.filter((c) => normalizeType(c.company_type) === normalizedRole);
}

export default function CompanyPickerScreen({
  profile,
  selectedId,
  roleFilter,
  onSelect,
  onLogout,
  onClose,
}: {
  profile: MeProfile;
  selectedId: number | null;
  roleFilter?: "buyer" | "supplier" | null;
  onSelect: (id: number) => void;
  onLogout: () => void;
  onClose?: () => void;
}) {
  const companies = filterCompanies(profile.companies || [], roleFilter || undefined);

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
  const subtitle = fullName || profile.email || "USC пользователь";
  const title = roleFilter === "supplier" ? "Выберите компанию поставщика" : roleFilter === "buyer" ? "Выберите компанию покупателя" : "Выберите компанию";

  if (!companies.length) {
    return (
      <section className="company-screen">
        <div className="company-card">
          <img src="/media/usc.svg" alt="USC" className="company-logo" />
          <div className="company-title">Нет компаний</div>
          <div className="company-subtitle">
            {roleFilter === "supplier"
              ? "Для этого аккаунта нет доступных компаний поставщика."
              : roleFilter === "buyer"
                ? "Для этого аккаунта нет доступных компаний покупателя."
                : "Для этого аккаунта нет доступных компаний."}
          </div>
          <button className="primary-button" type="button" onClick={onLogout}>
            Выйти
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="company-screen">
      <div className="company-card">
        {onClose && (
          <button className="company-close" type="button" onClick={onClose}>
            ×
          </button>
        )}
        <img src="/media/usc.svg" alt="USC" className="company-logo" />
        <div className="company-title">{title}</div>
        <div className="company-subtitle">{subtitle}</div>

        <div className="company-list">
          {companies.map((c) => (
            <button
              key={c.company_id}
              type="button"
              className={`company-item ${selectedId === c.company_id ? "active" : ""}`}
              onClick={() => onSelect(c.company_id)}
            >
              <div className="company-name">{c.name}</div>
              <div className="company-meta">
                {c.company_type ? c.company_type : "Компания"} {c.role ? `• ${c.role}` : ""}
              </div>
            </button>
          ))}
        </div>

        <button className="auth-link" type="button" onClick={onLogout}>
          Выйти из аккаунта
        </button>
      </div>
    </section>
  );
}
