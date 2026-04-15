import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import type { CartLine, CatalogProduct } from "@usc/core";
import { STORAGE_KEYS, getStoredJson, setStoredJson } from "@/storage/appStorage";

type CartContextValue = {
  items: CartLine[];
  count: number;
  total: number;
  loading: boolean;
  add(product: CatalogProduct): void;
  inc(productId: string): void;
  dec(productId: string): void;
  remove(productId: string): void;
  clear(): void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    void getStoredJson<CartLine[]>(STORAGE_KEYS.cart).then((stored) => {
      if (!mounted) return;
      setItems(Array.isArray(stored) ? stored : []);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    void setStoredJson(STORAGE_KEYS.cart, items);
  }, [items, loading]);

  const value = useMemo<CartContextValue>(() => ({
    items,
    count: items.reduce((sum, item) => sum + item.qty, 0),
    total: items.reduce((sum, item) => sum + item.qty * item.product.price, 0),
    loading,
    add(product) {
      setItems((prev) => {
        const index = prev.findIndex((line) => line.product.id === product.id);
        if (index >= 0) {
          const copy = [...prev];
          copy[index] = { ...copy[index], product, qty: copy[index].qty + 1 };
          return copy;
        }
        return [...prev, { product, qty: 1 }];
      });
    },
    inc(productId) {
      setItems((prev) => prev.map((line) => (line.product.id === productId ? { ...line, qty: line.qty + 1 } : line)));
    },
    dec(productId) {
      setItems((prev) =>
        prev
          .map((line) => (line.product.id === productId ? { ...line, qty: line.qty - 1 } : line))
          .filter((line) => line.qty > 0)
      );
    },
    remove(productId) {
      setItems((prev) => prev.filter((line) => line.product.id !== productId));
    },
    clear() {
      setItems([]);
    },
  }), [items, loading]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used inside CartProvider");
  }
  return context;
}
