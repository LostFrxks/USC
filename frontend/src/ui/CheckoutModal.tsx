import { lazy, Suspense, useMemo, useState } from "react";
import { validateLatLngInputs, type LatLng } from "../utils/geo";

const MapPicker = lazy(() => import("./MapPicker"));

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
    delivery_lat: number | null;
    delivery_lng: number | null;
    delivery_mode: "YANDEX" | "SUPPLIER_COURIER" | "BUYER_COURIER";
  }) => void | Promise<void>;
}) {
  const [address, setAddress] = useState("Улица Медерова, 161а");
  const [comment, setComment] = useState("");
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [latInput, setLatInput] = useState("");
  const [lngInput, setLngInput] = useState("");
  const [mapError, setMapError] = useState<string | null>(null);
  const [deliveryMode, setDeliveryMode] = useState<"YANDEX" | "SUPPLIER_COURIER" | "BUYER_COURIER">(
    "SUPPLIER_COURIER"
  );

  const coordInputState = useMemo(() => validateLatLngInputs(latInput, lngInput), [latInput, lngInput]);
  const showCoordsWarning = coordInputState.kind === "invalid_number" || coordInputState.kind === "out_of_range";

  const applyCoords = (next: LatLng | null) => {
    setCoords(next);
    setLatInput(next ? next.lat.toFixed(6) : "");
    setLngInput(next ? next.lng.toFixed(6) : "");
  };

  const syncCoordsFromInputs = (nextLatRaw: string, nextLngRaw: string) => {
    const nextState = validateLatLngInputs(nextLatRaw, nextLngRaw);
    if (nextState.kind === "valid") {
      setCoords(nextState.coords);
      return;
    }
    setCoords(null);
  };

  if (!open) return null;

  const submit = async () => {
    if (busy) return;
    await onSubmit({
      address: address.trim(),
      comment: comment.trim(),
      delivery_lat: coords?.lat ?? null,
      delivery_lng: coords?.lng ?? null,
      delivery_mode: deliveryMode,
    });
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
            <Suspense
              fallback={
                <div className="map-box">
                  <div className="map-inner is-loading" />
                </div>
              }
            >
              <MapPicker
                value={coords}
                disabled={busy}
                onChange={(next) => {
                  applyCoords(next);
                  setMapError(null);
                }}
                onError={(message) => setMapError(message)}
              />
            </Suspense>

            <div className="coords-row">
              <input
                className="field-input"
                placeholder="Широта"
                value={latInput}
                onChange={(e) => {
                  const nextLat = e.target.value;
                  setLatInput(nextLat);
                  syncCoordsFromInputs(nextLat, lngInput);
                }}
                disabled={busy}
              />
              <input
                className="field-input"
                placeholder="Долгота"
                value={lngInput}
                onChange={(e) => {
                  const nextLng = e.target.value;
                  setLngInput(nextLng);
                  syncCoordsFromInputs(latInput, nextLng);
                }}
                disabled={busy}
              />
            </div>
            {coordInputState.message ? <div className="coords-error">{coordInputState.message}</div> : null}

            <div className="map-actions">
              <span className={`map-badge ${coords ? "ok" : ""}`}>
                {coords ? "Точка выбрана" : "Точка не выбрана"}
              </span>
              <button
                className="btn-secondary"
                type="button"
                disabled={busy || !navigator.geolocation}
                onClick={() => {
                  if (!navigator.geolocation) return;
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      applyCoords({
                        lat: Number(pos.coords.latitude.toFixed(6)),
                        lng: Number(pos.coords.longitude.toFixed(6)),
                      });
                      setMapError(null);
                    },
                    () => {
                      setMapError("Не удалось определить геопозицию");
                    }
                  );
                }}
              >
                Определить мою геопозицию
              </button>
            </div>
            {mapError ? <div className="map-hint map-error">{mapError}</div> : null}
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
          {showCoordsWarning ? <span className="coords-warning">Координаты не будут добавлены</span> : null}
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
