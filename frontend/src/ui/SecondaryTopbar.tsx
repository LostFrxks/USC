export default function SecondaryTopbar({
  onBurger,
  onNotifications,
  address,
  notificationCount = 0,
}: {
  onBurger: () => void;
  onNotifications?: () => void;
  address?: string;
  notificationCount?: number;
}) {
  const storedCompany = typeof window !== "undefined" ? localStorage.getItem("usc_company_name") : "";
  const resolvedAddress = address || storedCompany || "Улица Медерова, 161а";

  return (
    <header className="topbar topbar-secondary">
      <button className="burger" onClick={onBurger} type="button" aria-label="Меню">
        <span className="burger-line" />
        <span className="burger-line" />
        <span className="burger-line" />
        <span className="burger-badge" />
      </button>

      <div className="address">
        {resolvedAddress} <span className="address-arrow">▼</span>
      </div>

      <button className="icon-button notification-button" data-testid="open-notifications" type="button" onClick={onNotifications} aria-label="�����������">
        <img src="/media/notifications.png" alt="Уведомления" />
        <span className={`icon-badge ${notificationCount > 0 ? "show" : ""}`}>{notificationCount > 0 ? notificationCount : ""}</span>
      </button>
    </header>
  );
}
