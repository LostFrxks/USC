import { useEffect, useState } from "react";
import type { Product } from "../types";
import { ProductCard, ProductCardSkeleton } from "../ui/ProductCard";
import ProductDetailsSheet from "../ui/ProductDetailsSheet";
import { useSupplierProducts } from "../hooks/useSupplierProducts";
import { preloadImages } from "../utils/imagePreload";

export default function SupplierScreen({
  active,
  supplierId,
  supplierName,
  cartCount,
  onBack,
  onAdd,
}: {
  active: boolean;
  supplierId: string | number | null;
  supplierName: string;
  cartCount: number;
  onBack: () => void;
  onAdd: (product: Product) => void;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 220);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!active) setSelectedProduct(null);
  }, [active]);

  const { products, loading, apiOk, apiEmpty } = useSupplierProducts(supplierId, debounced);

  useEffect(() => {
    preloadImages(products.slice(0, 4).map((product) => product.image));
  }, [products]);

  return (
    <section id="screen-supplier" className={`screen ${active ? "active" : ""}`}>
      <div className="topbar">
        <button type="button" className="burger" onClick={onBack} aria-label="Назад" title="Назад">
          ←
        </button>

        <div className="topbar-title" style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 900, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {supplierName || "Поставщик"}
          </div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Товары поставщика</div>
        </div>

        <div className="topbar-badge" title="Корзина">
          🛒 <span style={{ fontWeight: 900 }}>{cartCount}</span>
        </div>
      </div>

      <div className="search-card">
        <div className="search-top">
          <div className="search-title-row">
            <div className="search-title">Каталог</div>
          </div>

          <div className="searchbar">
            <span className="searchbar-iconwrap" aria-hidden="true">
              <img src="/media/search.png" alt="" className="searchbar-icon" />
            </span>

            <input
              className="searchbar-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Искать в товарах поставщика"
              inputMode="search"
            />

            <button
              type="button"
              className={`searchbar-clear ${query.length > 0 ? "show" : ""}`}
              onClick={() => setQuery("")}
              aria-label="Очистить"
              title="Очистить"
            >
              ×
            </button>
          </div>

          <div className="search-meta">{loading ? "Ищу..." : `${products.length} товаров`}</div>
        </div>

        <div className="search-card-body">
          {!apiOk ? (
            <div className="search-empty">
              <div className="search-empty-title">Сервис недоступен</div>
              <div className="search-empty-text">Проверь backend или endpoint фильтрации по supplier_company.</div>
            </div>
          ) : apiEmpty && !loading ? (
            <div className="search-empty">
              <div className="search-empty-title">Пусто</div>
              <div className="search-empty-text">У этого поставщика пока нет товаров (или запрос ничего не нашёл).</div>
            </div>
          ) : (
            <div className="product-grid">
              {loading ? (
                <>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <ProductCardSkeleton key={i} />
                  ))}
                </>
              ) : (
                products.map((p, idx) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    onAdd={() => onAdd(p)}
                    onOpen={() => setSelectedProduct(p)}
                    priority={idx < 4}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <ProductDetailsSheet
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAdd={() => {
          if (!selectedProduct) return;
          onAdd(selectedProduct);
        }}
      />
    </section>
  );
}
