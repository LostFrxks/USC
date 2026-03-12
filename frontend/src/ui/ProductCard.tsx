import type { Product } from "../types";

type ProductFact = { label: string; value: string };

function renderProductFacts(product: Product): ProductFact[] {
  const facts: ProductFact[] = [];
  if (typeof product.shelf_life_days === "number" && product.shelf_life_days > 0) {
    facts.push({ label: "Срок", value: `${product.shelf_life_days} дн` });
  }
  if (product.storage_condition) {
    facts.push({ label: "Хранение", value: product.storage_condition });
  }
  if (product.origin_country) {
    facts.push({ label: "Страна", value: product.origin_country });
  }
  if (product.package_type) {
    facts.push({ label: "Упаковка", value: product.package_type });
  }
  if (typeof product.net_weight_grams === "number" && product.net_weight_grams > 0) {
    facts.push({ label: "Вес", value: `${product.net_weight_grams} г` });
  }
  if (typeof product.lead_time_days === "number" && product.lead_time_days >= 0) {
    facts.push({ label: "Поставка", value: `${product.lead_time_days} дн` });
  }
  return facts.slice(0, 3);
}

export function ProductCard({
  product,
  onAdd,
  onOpen,
  priority = false,
}: {
  product: Product;
  onAdd: () => void;
  onOpen?: () => void;
  priority?: boolean;
}) {
  const priceText = typeof product.price === "number" && product.price > 0 ? `${product.price} сом` : "по запросу";
  const description = String(product.description || "").trim();
  const facts = renderProductFacts(product);
  const brandLine = [product.brand, product.manufacturer].filter(Boolean).join(" • ");
  const hasQualityMeta = Boolean(product.allergens || product.certifications);

  const isInteractive = typeof onOpen === "function";

  return (
    <article
      className={`product-card ${isInteractive ? "product-card--interactive" : ""}`}
      data-testid={`product-card-${product.id}`}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={isInteractive ? onOpen : undefined}
      onKeyDown={
        isInteractive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpen?.();
              }
            }
          : undefined
      }
    >
      <img
        src={product.image}
        alt={product.name}
        className="product-image"
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "low"}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = "/media/card_meat1.jpg";
        }}
      />

      <div className="product-body">
        <div className="product-price-row">
          <div className="product-price">{priceText}</div>
        </div>

        <div className="product-name">{product.name}</div>
        <div className="product-seller">{product.seller}</div>

        {description ? <div className="product-description">{description}</div> : null}
        {brandLine ? <div className="product-brand-line">{brandLine}</div> : null}

        {facts.length ? (
          <div className="product-facts">
            {facts.map((fact) => (
              <span key={`${fact.label}:${fact.value}`} className="product-fact-chip">
                <strong>{fact.label}:</strong> {fact.value}
              </span>
            ))}
          </div>
        ) : null}

        {hasQualityMeta ? (
          <div className="product-quality-note">
            {product.certifications ? `Сертификаты: ${product.certifications}` : null}
            {product.certifications && product.allergens ? " • " : null}
            {product.allergens ? `Аллергены: ${product.allergens}` : null}
          </div>
        ) : null}

        <div className="product-rating">
          <span>★ {product.rating}</span>
          <span className="muted">• {product.reviews} оценок</span>
        </div>

        <button
          className="primary-button"
          data-testid={`product-add-${product.id}`}
          onClick={(event) => {
            event.stopPropagation();
            onAdd();
          }}
          type="button"
        >
          В корзину
        </button>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <article className="product-card skeleton">
      <div className="product-image skeleton-block" />
      <div className="product-body">
        <div className="skeleton-line w-40" />
        <div className="skeleton-line w-70" />
        <div className="skeleton-line w-55" />
        <div className="skeleton-line w-60" />
        <div className="skeleton-pill" />
      </div>
    </article>
  );
}
