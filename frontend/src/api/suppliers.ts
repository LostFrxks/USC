import { api } from "./client";

export type SupplierApi = {
  id: number | string;
  name: string;

  // возможные поля (если есть на бэке)
  company_type?: string;
  address?: string;
  phone?: string;
  logo?: string | null;
};

export type Supplier = {
  id: string;
  name: string;
  subtitle: string;
  logo: string; // path в /public/media или placeholder
};

function normalizeSupplier(s: SupplierApi): Supplier {
  return {
    id: String(s.id),
    name: s.name ?? "Поставщик",
    subtitle: s.address ?? s.phone ?? "Поставщик USC",
    logo: (s.logo as string) || "/media/usc.svg",
  };
}

/**
 * Ожидаем список компаний-поставщиков.
 */
export async function fetchSuppliers(params?: { q?: string }) {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("search", params.q);

  const url = qs.toString()
    ? `/companies/suppliers/?${qs.toString()}`
    : "/companies/suppliers/";

  const data = await api<{ count: number; results: SupplierApi[] }>(url, { auth: false });
  return data.results.map(normalizeSupplier);
}
