import { useEffect, useState, type ChangeEvent } from "react";
import { isApiError } from "../api/client";
import { type MeProfile, updateMe } from "../api/profile";
import type { ToastTone } from "../hooks/useToast";
import SecondaryTopbar from "../ui/SecondaryTopbar";

type EditForm = {
  fullName: string;
  email: string;
  phone: string;
  companyName: string;
  companyPhone: string;
  warehouseAddress: string;
};

function splitFullName(input: string): { first_name: string; last_name: string } {
  const clean = (input || "").trim().replace(/\s+/g, " ");
  if (!clean) return { first_name: "", last_name: "" };
  const [first, ...rest] = clean.split(" ");
  return {
    first_name: first ?? "",
    last_name: rest.join(" ").trim(),
  };
}

export default function ProfileEditScreen({
  active,
  onBurger,
  onOpenNotifications,
  notificationCount,
  profile,
  activeCompanyId,
  onNotify,
  onSaved,
}: {
  active: boolean;
  onBurger: () => void;
  onOpenNotifications?: () => void;
  notificationCount?: number;
  profile: MeProfile | null;
  activeCompanyId: number | null;
  onNotify?: (message: string, tone?: ToastTone) => void;
  onSaved?: (profile: MeProfile) => void;
}) {
  const [form, setForm] = useState<EditForm>({
    fullName: "",
    email: "",
    phone: "",
    companyName: "",
    companyPhone: "",
    warehouseAddress: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!active || !profile) return;
    const activeCompany = (profile.companies || []).find((c) => c.company_id === activeCompanyId) ?? null;
    const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
    setForm({
      fullName,
      email: profile.email || "",
      phone: profile.phone || "",
      companyName: activeCompany?.name || "",
      companyPhone: activeCompany?.phone || "",
      warehouseAddress: activeCompany?.address || "",
    });
  }, [active, profile, activeCompanyId]);

  const initials = (form.fullName || form.companyName || "US")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase())
    .join("");

  const onChange = (key: keyof EditForm) => (e: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  return (
    <section id="screen-profile-edit" className={`screen ${active ? "active" : ""}`}>
      <SecondaryTopbar onBurger={onBurger} onNotifications={onOpenNotifications} notificationCount={notificationCount} />

      <header className="simple-header">
        <div className="simple-title">Редактирование профиля</div>
      </header>

      <div className="profile-edit-hero">
        <div className="profile-edit-avatar">{initials || "US"}</div>
        <div className="profile-edit-hero-main">
          <div className="profile-edit-hero-title">Личный кабинет</div>
          <div className="profile-edit-hero-subtitle">
            Обновите контакты пользователя и данные активной компании.
          </div>
        </div>
      </div>

      <form
        className="profile-edit-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!profile) {
            onNotify?.("Профиль не загружен", "error");
            return;
          }
          setBusy(true);
          try {
            const names = splitFullName(form.fullName);
            const updated = await updateMe({
              first_name: names.first_name,
              last_name: names.last_name,
              email: form.email.trim(),
              phone: form.phone.trim(),
              active_company_id: activeCompanyId ?? undefined,
              company_name: form.companyName.trim(),
              company_phone: form.companyPhone.trim(),
              company_address: form.warehouseAddress.trim(),
            });
            onSaved?.(updated);
            onNotify?.("Профиль сохранен", "success");
          } catch (error: unknown) {
            if (isApiError(error)) {
              if (error.status === 409) {
                onNotify?.("Email или телефон уже заняты", "error");
              } else if (error.status === 403) {
                onNotify?.("Нет прав для изменения компании", "error");
              } else if (error.status === 422) {
                onNotify?.("Проверьте корректность введенных данных", "error");
              } else {
                onNotify?.("Не удалось сохранить профиль", "error");
              }
            } else {
              onNotify?.("Не удалось сохранить профиль", "error");
            }
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="profile-edit-grid">
          <label className="profile-edit-field">
            <span className="profile-edit-label">ФИО пользователя</span>
            <div className="profile-edit-input-wrap">
              <span className="profile-edit-icon">U</span>
              <input type="text" value={form.fullName} onChange={onChange("fullName")} />
            </div>
          </label>

          <label className="profile-edit-field">
            <span className="profile-edit-label">Email</span>
            <div className="profile-edit-input-wrap">
              <span className="profile-edit-icon">@</span>
              <input type="email" value={form.email} onChange={onChange("email")} />
            </div>
          </label>

          <label className="profile-edit-field">
            <span className="profile-edit-label">Телефон пользователя</span>
            <div className="profile-edit-input-wrap">
              <span className="profile-edit-icon">#</span>
              <input type="tel" value={form.phone} onChange={onChange("phone")} />
            </div>
          </label>

          <label className="profile-edit-field">
            <span className="profile-edit-label">Название компании</span>
            <div className="profile-edit-input-wrap">
              <span className="profile-edit-icon">C</span>
              <input type="text" value={form.companyName} onChange={onChange("companyName")} />
            </div>
          </label>

          <label className="profile-edit-field">
            <span className="profile-edit-label">Телефон компании</span>
            <div className="profile-edit-input-wrap">
              <span className="profile-edit-icon">T</span>
              <input type="text" value={form.companyPhone} onChange={onChange("companyPhone")} />
            </div>
          </label>

          <label className="profile-edit-field">
            <span className="profile-edit-label">Адрес склада</span>
            <div className="profile-edit-input-wrap">
              <span className="profile-edit-icon">A</span>
              <input type="text" value={form.warehouseAddress} onChange={onChange("warehouseAddress")} />
            </div>
          </label>
        </div>

        <div className="profile-edit-foot">
          <div className="profile-edit-hint">Сохраняются данные пользователя и активной компании.</div>
          <button className="primary-button profile-edit-submit" type="submit" disabled={busy}>
            {busy ? "Сохраняем..." : "Сохранить изменения"}
          </button>
        </div>
      </form>
    </section>
  );
}

