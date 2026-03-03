export default function TopHeader({
  address,
  onBurger,
  badgeCount = 0,
}: {
  address?: string;
  onBurger?: () => void;
  badgeCount?: number;
}) {
  const storedCompany = typeof window !== "undefined" ? localStorage.getItem("usc_company_name") : "";
  const resolvedAddress = address || storedCompany || "Улица Медерова, 161а";

  return (
    <header className="topbar">
      <button className="burger" data-tour-id="top-burger" onClick={onBurger} type="button" aria-label="Меню">
        <span className="burger-line" />
        <span className="burger-line" />
        <span className="burger-line" />
        <span className={`burger-badge ${badgeCount > 0 ? "show" : ""}`} />
      </button>

      <div className="address">
        {resolvedAddress} <span className="address-arrow">▼</span>
      </div>
    </header>
  );
}
