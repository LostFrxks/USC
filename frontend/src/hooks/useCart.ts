import { useEffect, useMemo, useState } from "react";
import type {CartItem, Product } from "../types";

const LS_KEY = "usc_cart_v2";

function normalizeStoredItems(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x) => x && typeof x === "object")
    .map((x) => x as CartItem)
    .filter(
      (x) =>
        x.product &&
        typeof x.product.id === "string" &&
        typeof x.qty === "number" &&
        x.qty > 0 &&
        typeof x.product.supplier_company_id === "number" &&
        Number.isFinite(x.product.supplier_company_id)
    );
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const current = localStorage.getItem(LS_KEY);
      if (current) return normalizeStoredItems(JSON.parse(current));

      // One-time migration from old cart key.
      const legacy = localStorage.getItem("usc_cart_v1");
      if (legacy) {
        const migrated = normalizeStoredItems(JSON.parse(legacy));
        localStorage.setItem(LS_KEY, JSON.stringify(migrated));
        localStorage.removeItem("usc_cart_v1");
        return migrated;
      }
      return [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(items));
  }, [items]);

  const count = useMemo(() => items.reduce((s, x) => s + x.qty, 0), [items]);
  const total = useMemo(() => items.reduce((s, x) => s + x.qty * x.product.price, 0), [items]);

  function add(product: Product) {
    setItems((prev) => {
      const idx = prev.findIndex((x) => x.product.id === product.id);
      if (idx >= 0) {
        const copy = [...prev];
        // Refresh product snapshot so newly added API fields (e.g. supplier_company_id) are not stale.
        copy[idx] = { ...copy[idx], product, qty: copy[idx].qty + 1 };
        return copy;
      }
      return [...prev, { product, qty: 1 }];
    });
  }

  function remove(productId: string) {
    setItems((prev) => prev.filter((x) => x.product.id !== productId));
  }

  function setQty(productId: string, qty: number) {
    setItems((prev) =>
      prev
        .map((x) => (x.product.id === productId ? { ...x, qty } : x))
        .filter((x) => x.qty > 0)
    );
  }

  function clear() {
    setItems([]);
  }

  return { items, count, total, add, remove, setQty, clear };
}
