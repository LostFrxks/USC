import { useEffect, useState } from "react";
import { fetchSuppliers, type Supplier } from "../api/suppliers";

export function useSuppliers(query: string) {
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [apiOk, setApiOk] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    fetchSuppliers({ q: query || undefined })
      .then((data) => {
        if (!alive) return;
        setSuppliers(data);
        setApiOk(true);
      })
      .catch(() => {
        if (!alive) return;
        setSuppliers([]);
        setApiOk(false);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [query]);

  return { suppliers, loading, apiOk };
}
