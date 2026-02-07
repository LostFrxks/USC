import type { Screen } from "../types";

export function Drawer({
  open,
  onClose,
  onGo,
  onLogout,
  onSwitchCompany,
  companyName,
  role,
  notificationCount = 0,
}: {
  open: boolean;
  onClose: () => void;
  onGo: (s: Screen) => void;
  onLogout: () => void;
  onSwitchCompany: () => void;
  companyName?: string | null;
  role?: string | null;
  notificationCount?: number;
}) {
  return (
    <>
      <div className="overlay" style={{ display: open ? "block" : "none" }} onClick={onClose} />
      <aside className="drawer" style={{ transform: open ? "translateX(0)" : "translateX(-110%)" }}>
        <div className="drawer-header">
          <div className="drawer-avatar">
            <img src="/media/ava_burger.svg" alt="Профиль" id="drawer-avatar" />
          </div>
          <button className="drawer-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="drawer-rating">
          <div className="stars">
            <img src="/media/star.svg" alt="" className="star filled" />
            <img src="/media/star.svg" alt="" className="star filled" />
            <img src="/media/star.svg" alt="" className="star filled" />
            <img src="/media/star.svg" alt="" className="star filled" />
            <img src="/media/star_none.svg" alt="" className="star" />
          </div>
          <div className="drawer-rating-text" id="drawer-rating-text">
            4.0 · 85 отзывов
          </div>
          {companyName && <div className="drawer-company">{companyName}</div>}
          {role && <div className="drawer-role">{role}</div>}
        </div>

        <nav className="drawer-menu">
          <button className="drawer-link" onClick={() => (onGo("publications"), onClose())}>
            <img src="/media/your_publish.png" alt="" />
            <span>Ваши публикации</span>
          </button>

          <button className="drawer-link" onClick={() => (onGo("profile-edit"), onClose())}>
            <img src="/media/ava_burger1.svg" alt="" />
            <span>Редактирование профиля</span>
          </button>

          <button className="drawer-link" onClick={() => (onGo("orders"), onClose())}>
            <img src="/media/history.png" alt="" />
            <span>История заказов</span>
          </button>

          <button className="drawer-link" onClick={() => (onGo("deliveries"), onClose())}>
            <img src="/media/apple_car.svg" alt="" />
            <span>Доставки</span>
          </button>

          <button className="drawer-link" onClick={() => (onGo("notifications"), onClose())}>
            <img src="/media/notifications.png" alt="" />
            <span>Уведомления</span>
            <span className={`drawer-notification-badge ${notificationCount > 0 ? "show" : ""}`}>{notificationCount > 0 ? notificationCount : ""}</span>
          </button>

          <button className="drawer-link" onClick={() => (onGo("about"), onClose())}>
            <img src="/media/phone.png" alt="" />
            <span>О приложении</span>
          </button>

          <button className="drawer-link" onClick={() => (onGo("help"), onClose())}>
            <img src="/media/headphones.png" alt="" />
            <span>Помощь</span>
          </button>

          <button className="drawer-link" onClick={() => (onGo("faq"), onClose())}>
            <img src="/media/questions.png" alt="" />
            <span>Частые вопросы</span>
          </button>

          <button className="drawer-link" onClick={onSwitchCompany}>
            <img src="/media/ava_burger1.svg" alt="" />
            <span>Сменить компанию</span>
          </button>

          <button className="drawer-link drawer-logout" onClick={onLogout}>
            <img src="/media/icon.png" alt="" />
            <span>Выйти</span>
          </button>
        </nav>
      </aside>
    </>
  );
}
