import SecondaryTopbar from "../ui/SecondaryTopbar";

export default function ProfileEditScreen({
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
    <section id="screen-profile-edit" className={`screen ${active ? "active" : ""}`}>
      <SecondaryTopbar onBurger={onBurger} onNotifications={onOpenNotifications} notificationCount={notificationCount} />

      <header className="simple-header">
        <div className="simple-title">Редактирование профиля</div>
      </header>

      <form
        className="profile-edit-form"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <label className="profile-edit-field">
          <span>Название аккаунта</span>
          <input type="text" defaultValue="USC Premium Seller" />
        </label>
        <label className="profile-edit-field">
          <span>Email</span>
          <input type="email" defaultValue="seller@usc.market" />
        </label>
        <label className="profile-edit-field">
          <span>Телефон</span>
          <input type="text" defaultValue="+996 500 000 000" />
        </label>
        <label className="profile-edit-field">
          <span>Адрес склада</span>
          <input type="text" defaultValue="Бишкек, Медерова 161а" />
        </label>
        <button className="primary-button profile-edit-submit" type="submit">
          Сохранить изменения
        </button>
      </form>
    </section>
  );
}
