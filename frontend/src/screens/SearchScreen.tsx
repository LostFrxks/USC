import { useEffect, useMemo, useState } from "react";
import type { Product } from "../types";
import { ProductCard, ProductCardSkeleton } from "../ui/ProductCard";
import ProductDetailsSheet from "../ui/ProductDetailsSheet";
import TopHeader from "../ui/TopHeader";
import { useProducts } from "../hooks/useProducts";
import { fetchSuppliers, type Supplier } from "../api/suppliers";

export default function SearchScreen({
  active,
  initialCategoryId,
  onOpenFilters,
  onAdd,
  cartCount,
  onBurger,
  onOpenSupplier,
}: {
  active: boolean;
  initialCategoryId: number | null;
  onOpenFilters: () => void;
  onAdd: (product: Product) => void;
  cartCount: number;
  onBurger: () => void;
  onOpenSupplier: (s: Supplier) => void;
}) {
  void onOpenFilters;

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const [supLoading, setSupLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supOk, setSupOk] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 220);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!active) return;
    setCategoryId(typeof initialCategoryId === "number" ? initialCategoryId : null);
  }, [active, initialCategoryId]);

  useEffect(() => {
    if (!active) setSelectedProduct(null);
  }, [active]);

  const { products, loading } = useProducts(categoryId, debounced);
  const filteredProducts = useMemo(() => products ?? [], [products]);

  useEffect(() => {
    let alive = true;
    if (!active || !debounced) return;

    setSupLoading(true);
    setSupOk(true);

    fetchSuppliers({ q: debounced || undefined })
      .then((data) => {
        if (!alive) return;
        setSuppliers(data);
        setSupOk(true);
      })
      .catch(() => {
        if (!alive) return;
        setSuppliers([]);
        setSupOk(false);
      })
      .finally(() => {
        if (!alive) return;
        setSupLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [active, debounced]);

  const showEmpty = !loading && debounced.length === 0;

  return (
    <section id="screen-search" className={`screen ${active ? "active" : ""}`}>
      <TopHeader onBurger={onBurger} badgeCount={cartCount} />
      <header className="simple-header">
        <div className="simple-title">Поиск</div>
      </header>

      <div className="search-box">
        <button className="icon-button" type="button" aria-label="Поиск">
          <img src="/media/search.png" alt="Поиск" />
        </button>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Искать товар или поставщика"
        />
        <button className="clear-search" type="button" onClick={() => setQuery("")} aria-label="Очистить">
          ×
        </button>
      </div>

      {showEmpty ? (
        <div className="search-empty">Начните вводить название товара или поставщика</div>
      ) : (
        <>
          <div className="product-grid" id="search-list">
            {loading ? (
              <>
                {Array.from({ length: 6 }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </>
            ) : (
              filteredProducts.map((p) => (
                <ProductCard key={p.id} product={p} onAdd={() => onAdd(p)} onOpen={() => setSelectedProduct(p)} />
              ))
            )}
          </div>

          {supOk && !supLoading && suppliers.length > 0 && (
            <ul className="search-list">
              {suppliers.map((s) => (
                <li key={String(s.id)}>
                  <button className="search-list-btn" type="button" onClick={() => onOpenSupplier(s)}>
                    {s.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

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
