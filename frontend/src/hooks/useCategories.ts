import { useEffect, useState } from "react";
import { fetchCategories, type CategoryApi } from "../api/categories";

export function useCategories() {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<CategoryApi[]>([]);
  const [apiOk, setApiOk] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    fetchCategories()
      .then((data) => {
        if (!alive) return;
        setCategories(data);
        setApiOk(true);
      })
      .catch(() => {
        if (!alive) return;
        setCategories([]);
        setApiOk(false);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  return { categories, loading, apiOk };
}
