import { useMemo, useState } from "react";
import SecondaryTopbar from "../ui/SecondaryTopbar";

type Msg = { id: string; type: "incoming" | "outgoing"; text: string; meta: string };

export default function HelpScreen({
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
  const initial = useMemo<Msg[]>(
    () => [
      {
        id: "m1",
        type: "incoming",
        text: "Здравствуйте, это поддержка USC. Напишите, если нужна помощь с заказами или поставщиками.",
        meta: "USC Support",
      },
      {
        id: "m2",
        type: "outgoing",
        text: "Добрый день, мы тестируем экран помощи в рамках MVP. Поддержите проект!",
        meta: "Вы",
      },
    ],
    []
  );

  const [messages, setMessages] = useState<Msg[]>(initial);
  const [value, setValue] = useState("");

  const send = () => {
    const text = value.trim();
    if (!text) return;
    const id = `m${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id, type: "outgoing", text, meta: "Вы" },
      {
        id: `${id}-reply`,
        type: "incoming",
        text:
          "Спасибо за запрос. В полной версии приложения здесь будет живой оператор или AI-помощник.",
        meta: "USC Support",
      },
    ]);
    setValue("");
  };

  return (
    <section id="screen-help" className={`screen ${active ? "active" : ""}`}>
      <SecondaryTopbar onBurger={onBurger} onNotifications={onOpenNotifications} notificationCount={notificationCount} />

      <header className="simple-header">
        <div className="simple-title">Помощь</div>
      </header>

      <div className="help-chat">
        <div className="help-chat-window">
          {messages.map((m) => (
            <div key={m.id} className={`help-chat-message ${m.type}`}>
              <div>{m.text}</div>
              <div className="help-chat-meta">{m.meta}</div>
            </div>
          ))}
        </div>

        <form
          className="help-chat-input"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Напишите вопрос по работе USC"
            autoComplete="off"
          />
          <button className="primary-button help-chat-send" type="submit">
            Отправить
          </button>
        </form>
      </div>
    </section>
  );
}
