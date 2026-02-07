import { useState } from "react";

export default function CheckoutModal({
  open,
  total,
  busy = false,
  onClose,
  onSubmit,
}: {
  open: boolean;
  total: number;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (data: {
    address: string;
    comment: string;
    delivery_mode: "YANDEX" | "SUPPLIER_COURIER" | "BUYER_COURIER";
  }) => void | Promise<void>;
}) {
  const [address, setAddress] = useState("Улица Медерова, 161а");
  const [comment, setComment] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [deliveryMode, setDeliveryMode] = useState<"YANDEX" | "SUPPLIER_COURIER" | "BUYER_COURIER">(
    "SUPPLIER_COURIER"
  );

  if (!open) return null;

  const submit = async () => {
    if (busy) return;
    const geo = coords ? `\n[geo:${coords.lat.toFixed(6)},${coords.lng.toFixed(6)}]` : "";
    const finalComment = `${comment.trim()}${geo}`.trim();
    await onSubmit({ address: address.trim(), comment: finalComment, delivery_mode: deliveryMode });
  };

  return (
    <div className="modal-overlay show" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-head">
          <div className="modal-title">Оформление заказа</div>
          <button className="modal-x" type="button" onClick={onClose} disabled={busy} aria-label="Закрыть">
            ×
          </button>
        </div>

        <div className="modal-body">
          <label className="field">
            <div className="field-label">Адрес доставки</div>
            <input
              className="field-input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Введите адрес"
              disabled={busy}
            />
          </label>

          <div className="field">
            <div className="field-label">Координаты (опционально)</div>
            <div className="coords-row">
              <input
                className="field-input"
                placeholder="Широта"
                value={coords ? coords.lat : ""}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v)) setCoords({ lat: v, lng: coords?.lng ?? 0 });
                  else setCoords(null);
                }}
                disabled={busy}
              />
              <input
                className="field-input"
                placeholder="Долгота"
                value={coords ? coords.lng : ""}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v)) setCoords({ lat: coords?.lat ?? 0, lng: v });
                  else setCoords(null);
                }}
                disabled={busy}
              />
            </div>

            <div className="map-actions">
              <button
                className="btn-secondary"
                type="button"
                disabled={busy || !navigator.geolocation}
                onClick={() => {
                  if (!navigator.geolocation) return;
                  navigator.geolocation.getCurrentPosition(
                    (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                    () => {
                      // ignore geolocation errors
                    }
                  );
                }}
              >
                Определить мою геопозицию
              </button>

              {coords && (
                <a
                  className="map-link"
                  href={`https://www.openstreetmap.org/?mlat=${coords.lat}&mlon=${coords.lng}#map=16/${coords.lat}/${coords.lng}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Открыть на карте
                </a>
              )}
            </div>
          </div>

          <label className="field">
            <div className="field-label">Комментарий к заказу</div>
            <input
              className="field-input"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Например: позвонить за 10 минут"
              disabled={busy}
            />
          </label>

          <label className="field">
            <div className="field-label">Тип доставки</div>
            <select
              className="field-input"
              value={deliveryMode}
              onChange={(e) => setDeliveryMode(e.target.value as typeof deliveryMode)}
              disabled={busy}
            >
              <option value="SUPPLIER_COURIER">Курьер поставщика</option>
              <option value="BUYER_COURIER">Свой курьер</option>
              <option value="YANDEX">Внешняя доставка (Yandex)</option>
            </select>
          </label>

          <div className="modal-total">
            <span>Итого</span>
            <b>{total} сом</b>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" type="button" onClick={onClose} disabled={busy}>
            Отмена
          </button>
          <button className="btn-primary" type="button" onClick={submit} disabled={busy || !address.trim()}>
            {busy ? "Создаю..." : "Создать заказ"}
          </button>
        </div>
      </div>
    </div>
  );
}
