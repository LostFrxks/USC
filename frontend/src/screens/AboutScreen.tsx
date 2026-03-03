import { useEffect, useRef, useState } from "react";
import SecondaryTopbar from "../ui/SecondaryTopbar";

export default function AboutScreen({
  active,
  onBurger,
  onOpenNotifications,
  notificationCount,
  onboardingReplayRequested = false,
  onRequestOnboardingReplay,
}: {
  active: boolean;
  onBurger: () => void;
  onOpenNotifications?: () => void;
  notificationCount?: number;
  onboardingReplayRequested?: boolean;
  onRequestOnboardingReplay?: (nextValue: boolean) => void;
}) {
  const tapCountRef = useRef(0);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    if (!active) {
      tapCountRef.current = 0;
      setAdvancedOpen(false);
    }
  }, [active]);

  const onVersionTap = () => {
    tapCountRef.current += 1;
    if (tapCountRef.current >= 5) setAdvancedOpen(true);
  };

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
        <button type="button" className="about-version about-version-tap" data-tour-id="about-version" onClick={onVersionTap}>
          USC · Unity Supply Chain · v0.1 MVP
        </button>
        <div className="about-text">USC помогает бизнесам:</div>
        <ul className="about-list">
          <li>находить надёжных поставщиков продуктов и сырья</li>
          <li>отправлять заказы в пару кликов с телефона</li>
          <li>контролировать оплату и доставку в одном месте</li>
        </ul>
        <div className="about-footnote">
          Этот экран показывает нашу визуализацию продукта. Полная версия будет работать в мобильном приложении USC.
        </div>

        {advancedOpen ? (
          <div className="about-advanced" data-testid="about-advanced">
            <div className="about-advanced-title">Advanced</div>
            <label className="about-advanced-option">
              <input
                type="checkbox"
                checked={onboardingReplayRequested}
                onChange={(event) => onRequestOnboardingReplay?.(event.target.checked)}
              />
              <span>Пройти гайд еще раз при следующем входе</span>
            </label>
            <div className="about-advanced-hint">После следующего входа в приложение гид запустится заново.</div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
