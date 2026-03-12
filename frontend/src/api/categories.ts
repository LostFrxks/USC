import { api } from "./client";

export type CategoryApi = { id: number; name: string };

type ApiPage<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

const CATEGORIES_TTL_MS = 5 * 60 * 1000;

let categoriesCache: { data: CategoryApi[]; expiresAt: number } | null = null;
let categoriesInFlight: Promise<CategoryApi[]> | null = null;

export async function fetchCategories(): Promise<CategoryApi[]> {
  const now = Date.now();
  if (categoriesCache && categoriesCache.expiresAt > now) {
    return categoriesCache.data;
  }

  if (categoriesInFlight) {
    return categoriesInFlight;
  }

  categoriesInFlight = api<ApiPage<CategoryApi>>("/categories/", { auth: false })
    .then((page) => {
      const results = page.results;
      categoriesCache = { data: results, expiresAt: Date.now() + CATEGORIES_TTL_MS };
      return results;
    })
    .finally(() => {
      categoriesInFlight = null;
    });

  return categoriesInFlight;
}
