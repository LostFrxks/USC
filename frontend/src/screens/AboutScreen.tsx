import SecondaryTopbar from "../ui/SecondaryTopbar";

export default function AboutScreen({
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
  return (
    <section id="screen-about" className={`screen ${active ? "active" : ""}`}>
      <SecondaryTopbar onBurger={onBurger} onNotifications={onOpenNotifications} notificationCount={notificationCount} />

      <header className="simple-header">
        <div className="simple-title">О приложении</div>
      </header>

      <div className="about-card">
        <div className="about-logo-row">
          <img src="/media/usc.svg" alt="USC" className="about-logo" />
        </div>
        <div className="about-version">USC · Unity Supply Chain · v0.1 MVP</div>
        <div className="about-text">USC помогает бизнесам:</div>
        <ul className="about-list">
          <li>находить надёжных поставщиков продуктов и сырья</li>
          <li>отправлять заказы в пару кликов с телефона</li>
          <li>контролировать оплату и доставку в одном месте</li>
        </ul>
        <div className="about-footnote">
          Этот экран показывает нашу визуализацию продукта. Полная версия будет работать в мобильном приложении USC.
        </div>
      </div>
    </section>
  );
}
