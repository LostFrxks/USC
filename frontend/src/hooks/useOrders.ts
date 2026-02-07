import { useCallback, useEffect, useState } from "react";
import { fetchOrders, fetchOrdersInbox, fetchOrdersOutbox, type Order } from "../api/orders";

export function useOrders(
  active: boolean,
  params?: {
    buyerCompanyId?: number | null;
    source?: "buyer" | "inbox" | "outbox";
  }
) {
  const buyerCompanyId = params?.buyerCompanyId ?? null;
  const source = params?.source ?? "buyer";
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [apiOk, setApiOk] = useState(true);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((x) => x + 1), []);

  useEffect(() => {
    if (!active) return;

    if (source === "buyer" && !buyerCompanyId) {
      setOrders([]);
      setApiOk(true);
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);

    const load =
      source === "buyer"
        ? fetchOrders({ buyerCompanyId, limit: 50, offset: 0 })
        : source === "outbox"
          ? fetchOrdersOutbox()
          : fetchOrdersInbox();

    load
      .then((data) => {
        if (!alive) return;
        setOrders(data);
        setApiOk(true);
      })
      .catch(() => {
        if (!alive) return;
        setOrders([]);
        setApiOk(false);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [active, buyerCompanyId, source, nonce]);

  return { loading, orders, apiOk, reload };
}
