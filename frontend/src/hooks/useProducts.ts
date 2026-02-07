import { useEffect, useState } from "react";
import { fetchProducts } from "../api/products";
import type { Product } from "../types";

export function useProducts(categoryId: number | null, query: string) {
  const [loading, setLoading] = useState(true);
  const [apiProducts, setApiProducts] = useState<Product[]>([]);
  const [apiOk, setApiOk] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    fetchProducts({ categoryId: categoryId ?? undefined, q: query || undefined })
      .then((data) => {
        if (!alive) return;
        setApiProducts(data);
        setApiOk(true);
      })
      .catch(() => {
        if (!alive) return;
        setApiOk(false);
        setApiProducts([]);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [categoryId, query]);

  // теперь демо-фоллбек можно убрать или оставить на будущее
  return { products: apiProducts, loading, apiOk, apiEmpty: apiOk && apiProducts.length === 0 };
}
