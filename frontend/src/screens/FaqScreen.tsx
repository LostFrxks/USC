import { useState } from "react";
import SecondaryTopbar from "../ui/SecondaryTopbar";

const FAQ = [
  {
    q: "Как работает оплата через USC?",
    a: "Заказ фиксируется в системе, клиент оплачивает через партнёров USC, деньги блокируются на счёте и перечисляются поставщику только после подтверждения доставки.",
  },
  {
    q: "Кто может размещать товары в USC?",
    a: "Фермеры, оптовые поставщики, производители продуктов и упаковки, которые прошли проверку команды USC и подтвердили качество поставок.",
  },
  {
    q: "Можно работать только с одним поставщиком?",
    a: "Да, можно. Но сила USC в том, что вы видите сразу несколько предложений по цене, качеству и условиям доставки в одном интерфейсе и выбираете лучшее.",
  },
  {
    q: "Нужно ли что-то устанавливать для покупателей?",
    a: "Для покупателей будет мобильное приложение USC. Сейчас в этом MVP мы показываем сторону поставщика и то, как он управляет своими заказами.",
  },
];

export default function FaqScreen({
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
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="screen-faq" className={`screen ${active ? "active" : ""}`}>
      <SecondaryTopbar onBurger={onBurger} onNotifications={onOpenNotifications} notificationCount={notificationCount} />

      <header className="simple-header">
        <div className="simple-title">Частые вопросы</div>
      </header>

      <div className="faq-list">
        {FAQ.map((item, idx) => {
          const open = openIndex === idx;
          return (
            <div key={item.q} className={`faq-item ${open ? "open" : ""}`}>
              <button
                className="faq-question"
                type="button"
                onClick={() => setOpenIndex(open ? null : idx)}
              >
                {item.q}
              </button>
              <div className="faq-answer">{item.a}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
