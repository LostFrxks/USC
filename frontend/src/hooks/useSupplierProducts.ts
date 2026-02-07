import { useEffect, useState } from "react";
import type { Product } from "../types";
import { fetchProducts } from "../api/products";

export function useSupplierProducts(supplierId: string | number | null, query: string) {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [apiOk, setApiOk] = useState(true);

  useEffect(() => {
    let alive = true;

    if (!supplierId) {
      setProducts([]);
      setApiOk(true);
      setLoading(false);
      return;
    }

    setLoading(true);

    fetchProducts({ supplierId, q: query || undefined })
      .then((data) => {
        if (!alive) return;
        setProducts(data);
        setApiOk(true);
      })
      .catch(() => {
        if (!alive) return;
        setProducts([]);
        setApiOk(false);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [supplierId, query]);

  return { products, loading, apiOk, apiEmpty: apiOk && products.length === 0 };
}
