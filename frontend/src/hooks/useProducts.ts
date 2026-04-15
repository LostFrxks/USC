import { useEffect, useRef, useState } from "react";
import { fetchProducts } from "../api/products";
import type { Product } from "../types";

export function useProducts(categoryId: number | null, query: string) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiProducts, setApiProducts] = useState<Product[]>([]);
  const [apiOk, setApiOk] = useState(true);
  const hasRenderedProductsRef = useRef(false);

  useEffect(() => {
    hasRenderedProductsRef.current = apiProducts.length > 0;
  }, [apiProducts.length]);

  useEffect(() => {
    let alive = true;

    const timer = window.setTimeout(() => {
      const hasRenderedProducts = hasRenderedProductsRef.current;
      if (hasRenderedProducts) setRefreshing(true);
      else setLoading(true);

      fetchProducts({ categoryId: categoryId ?? undefined, q: query || undefined })
        .then((data) => {
          if (!alive) return;
          setApiProducts(data);
          setApiOk(true);
        })
        .catch(() => {
          if (!alive) return;
          setApiOk(false);
          if (!hasRenderedProducts) setApiProducts([]);
        })
        .finally(() => {
          if (!alive) return;
          setLoading(false);
          setRefreshing(false);
        });
    }, 140);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [categoryId, query]);

  return { products: apiProducts, loading, refreshing, apiOk, apiEmpty: apiOk && apiProducts.length === 0 };
}
