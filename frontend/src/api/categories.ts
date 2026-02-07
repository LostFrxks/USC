import { api } from "./client";

export type CategoryApi = { id: number; name: string };

type ApiPage<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export async function fetchCategories(): Promise<CategoryApi[]> {
  const page = await api<ApiPage<CategoryApi>>("/categories/", { auth: false });
  return page.results;
}
