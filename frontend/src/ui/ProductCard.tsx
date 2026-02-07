import type { Product } from "../types";

export function ProductCard({
  product,
  onAdd,
}: {
  product: Product;
  onAdd: () => void;
}) {
  const priceText =
    typeof (product as any).price === "number" && (product as any).price > 0
      ? `${(product as any).price} сом`
      : "по запросу";

  return (
    <article className="product-card">
      <img
        src={(product as any).image}
        alt={(product as any).name}
        className="product-image"
        loading="lazy"
        onError={(e) => {
          // если вдруг путь кривой — покажем заглушку
          (e.currentTarget as HTMLImageElement).src = "/media/card_meat1.jpg";
        }}
      />

      <div className="product-body">
        <div className="product-price-row">
          <div className="product-price">{priceText}</div>
        </div>

        <div className="product-name">{(product as any).name}</div>
        <div className="product-seller">{(product as any).seller}</div>

        <div className="product-rating">
          <span>★ {(product as any).rating}</span>
          <span className="muted">· {(product as any).reviews} оценок</span>
        </div>

        <button className="primary-button" onClick={onAdd} type="button">
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
