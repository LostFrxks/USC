import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { Category, Product } from "../types";
import TopHeader from "../ui/TopHeader";
import { ProductCard, ProductCardSkeleton } from "../ui/ProductCard";
import ProductDetailsSheet from "../ui/ProductDetailsSheet";
import { useProducts } from "../hooks/useProducts";
import { preloadImages } from "../utils/imagePreload";

const CATEGORIES: Array<{
  key: Category;
  icon: string;
  alt: string;
  imgStyle?: React.CSSProperties;
  btnStyle?: React.CSSProperties;
  imgClassName?: string;
}> = [
  { key: "meat", icon: "/media/meat.svg", alt: "Мясо", imgStyle: { width: 58, height: 40 } },
  { key: "milk", icon: "/media/milk.svg", alt: "Молоко", imgStyle: { width: 35, height: 50 } },
  { key: "fish", icon: "/media/fish.svg", alt: "Рыба", imgStyle: { width: 55.2, height: 35 } },
  {
    key: "fruit",
    icon: "/media/apple_car.svg",
    alt: "Овощи и фрукты",
    btnStyle: { display: "flex", paddingBottom: 10, width: 40 },
    imgStyle: { width: 62.1, height: 45 },
  },
  { key: "bread", icon: "/media/bread.svg", alt: "Хлеб", imgStyle: { width: 62.1, height: 45 } },
  {
    key: "grain",
    icon: "/media/wh.svg",
    alt: "Крупы",
    btnStyle: { width: 40 },
    imgStyle: { width: 60.2, height: 45 },
    imgClassName: "grain",
  },
];

const CATEGORY_TO_ID: Record<Category, number> = {
  meat: 1,
  milk: 2,
  fish: 3,
  bread: 4,
  fruit: 5,
  grain: 6,
};

export default function HomeScreen({
  active,
  cartCount,
  onBurger,
  onAdd,
  showCompanyBanner = false,
  onPickCompany,
  onCategoryChange,
}: {
  active: boolean;
  cartCount: number;
  onBurger: () => void;
  onAdd: (product: Product) => void;
  showCompanyBanner?: boolean;
  onPickCompany?: () => void;
  onCategoryChange?: (category: Category) => void;
}) {
  const [category, setCategory] = useState<Category>("meat");
  const [query, setQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const categoryId = CATEGORY_TO_ID[category];
  const deferredQuery = useDeferredValue(query.trim());
  const { products, loading } = useProducts(categoryId, deferredQuery);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!active) setSelectedProduct(null);
  }, [active]);

  useEffect(() => {
    onCategoryChange?.(category);
  }, [category, onCategoryChange]);

  const filteredProducts = useMemo(() => products ?? [], [products]);

  useEffect(() => {
    preloadImages(filteredProducts.slice(0, 4).map((product) => product.image));
  }, [filteredProducts]);

  return (
    <section id="screen-home" data-testid="screen-home" className={`screen ${active ? "active" : ""}`}>
      <TopHeader onBurger={onBurger} badgeCount={cartCount} />

      {showCompanyBanner ? (
        <div className="company-banner">
          <div>
            <div className="company-banner-title">Добавь компанию</div>
            <div className="company-banner-text">Без компании заказы и аналитика будут ограничены.</div>
          </div>
          <button className="company-banner-btn" type="button" onClick={onPickCompany}>
            Выбрать
          </button>
        </div>
      ) : null}

      <div className="home-card">
        <div className="logo-row">
          <img src="/media/usc.svg" alt="USC" className="logo" />
        </div>

        <div className="search-box home-inline-search" data-tour-id="home-search-box">
          <button className="icon-button" type="button" aria-label="Поиск">
            <img src="/media/search.png" alt="Поиск" />
          </button>
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Искать товар или поставщика"
          />
          <button className="clear-search" type="button" onClick={() => setQuery("")} aria-label="Очистить">
            ×
          </button>
        </div>

        <div className="categories" data-tour-id="home-categories">
          <button className="category category-search" type="button" onClick={() => searchInputRef.current?.focus()}>
            <img src="/media/search.png" alt="Поиск" style={{ width: 40, height: 40, borderRadius: 999 }} />
          </button>
          {CATEGORIES.map((item) => {
            const isActive = category === item.key;

            return (
              <button
                key={item.key}
                className={`category ${isActive ? "active" : ""}`}
                style={item.btnStyle}
                onClick={() => setCategory(item.key)}
                type="button"
                data-category={item.key}
              >
                <img
                  src={item.icon}
                  alt={item.alt}
                  className={item.imgClassName}
                  style={item.imgStyle}
                  onError={(e) => {
                    const img = e.currentTarget;
                    if (item.key === "fruit") img.src = "/media/apple_car.png";
                    if (item.key === "grain") img.src = "/media/pshenica.png";
                  }}
                />
              </button>
            );
          })}
        </div>

        <div className="premium-banner">USC Премиум</div>

        <div className="product-grid" id="product-grid" data-testid="home-product-grid" data-tour-id="home-product-grid">
          {loading ? (
            <>
              {Array.from({ length: 6 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </>
          ) : filteredProducts.length === 0 ? (
            <div className="search-empty">Ничего не найдено. Попробуйте другой запрос.</div>
          ) : (
            filteredProducts.map((p, idx) => (
              <ProductCard
                key={`${p.id}-${idx}`}
                product={p}
                onAdd={() => onAdd(p)}
                onOpen={() => setSelectedProduct(p)}
                priority={idx < 4}
              />
            ))
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
