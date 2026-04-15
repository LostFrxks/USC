import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Product } from "../types";

type ProductDetailFact = { label: string; value: string };

function buildDetailFacts(product: Product): ProductDetailFact[] {
  const facts: ProductDetailFact[] = [];
  if (product.brand) facts.push({ label: "Бренд", value: product.brand });
  if (product.manufacturer) facts.push({ label: "Производитель", value: product.manufacturer });
  if (typeof product.shelf_life_days === "number" && product.shelf_life_days > 0) {
    facts.push({ label: "Срок годности", value: `${product.shelf_life_days} дн` });
  }
  if (product.storage_condition) facts.push({ label: "Хранение", value: product.storage_condition });
  if (product.origin_country) facts.push({ label: "Страна", value: product.origin_country });
  if (product.package_type) facts.push({ label: "Упаковка", value: product.package_type });
  if (typeof product.net_weight_grams === "number" && product.net_weight_grams > 0) {
    facts.push({ label: "Вес нетто", value: `${product.net_weight_grams} г` });
  }
  if (typeof product.lead_time_days === "number" && product.lead_time_days >= 0) {
    facts.push({ label: "Lead time", value: `${product.lead_time_days} дн` });
  }
  return facts;
}

export default function ProductDetailsSheet({
  product,
  onClose,
  onAdd,
}: {
  product: Product | null;
  onClose: () => void;
  onAdd: () => void;
}) {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    if (!product) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [product]);

  const detailFacts = useMemo(() => (product ? buildDetailFacts(product) : []), [product]);

  if (!product || !portalRoot) return null;

  const priceText =
    typeof product.price === "number" && product.price > 0
      ? `${Math.round(product.price).toLocaleString("ru-RU")} сом`
      : "по запросу";
  const ratingText = product.rating ? String(product.rating).trim() : "";
  const reviewsCount = typeof product.reviews === "number" && Number.isFinite(product.reviews) ? product.reviews : null;
  const showRating = Boolean(ratingText) || reviewsCount != null;

  return createPortal(
    <div className="product-sheet-overlay" onClick={onClose}>
      <section className="product-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="product-sheet-handle" aria-hidden="true" />

        <button type="button" className="product-sheet-close" onClick={onClose} aria-label="Закрыть карточку товара">
          ×
        </button>

        <div className="product-sheet-media-wrap">
          <img
            src={product.image}
            alt={product.name}
            className="product-sheet-media"
            onError={(event) => {
              (event.currentTarget as HTMLImageElement).src = "/media/card_meat1.jpg";
            }}
          />
          <div className="product-sheet-price">{priceText}</div>
        </div>

        <div className="product-sheet-content">
          <div className="product-sheet-name">{product.name}</div>
          <div className="product-sheet-seller">{product.seller}</div>

          {product.description ? <p className="product-sheet-description">{product.description}</p> : null}

          {detailFacts.length ? (
            <div className="product-sheet-facts">
              {detailFacts.map((fact) => (
                <div key={`${fact.label}:${fact.value}`} className="product-sheet-fact-item">
                  <span className="product-sheet-fact-label">{fact.label}</span>
                  <span className="product-sheet-fact-value">{fact.value}</span>
                </div>
              ))}
            </div>
          ) : null}

          {product.certifications ? (
            <div className="product-sheet-note">
              <strong>Сертификаты:</strong> {product.certifications}
            </div>
          ) : null}
          {product.allergens ? (
            <div className="product-sheet-note product-sheet-note--warn">
              <strong>Аллергены:</strong> {product.allergens}
            </div>
          ) : null}

          <div className="product-sheet-footer">
            {showRating ? (
              <div className="product-sheet-rating">
                {ratingText ? `★ ${ratingText}` : ""}
                {reviewsCount != null ? `${ratingText ? " • " : ""}${reviewsCount} оценок` : ""}
              </div>
            ) : (
              <span />
            )}
            <button
              type="button"
              className="primary-button product-sheet-add"
              onClick={() => {
                onAdd();
                onClose();
              }}
            >
              В корзину
            </button>
          </div>
        </div>
      </section>
    </div>,
    portalRoot
  );
}
