import { api } from "./client";

export type SupplierApi = {
  id: number | string;
  name: string;
  company_type?: string;
  address?: string;
  phone?: string;
  logo?: string | null;
};

export type Supplier = {
  id: string;
  name: string;
  subtitle: string;
  logo: string;
};

const SUPPLIERS_TTL_MS = 60 * 1000;
const suppliersCache = new Map<string, { data: Supplier[]; expiresAt: number }>();
const suppliersInFlight = new Map<string, Promise<Supplier[]>>();

function normalizeSupplier(s: SupplierApi): Supplier {
  return {
    id: String(s.id),
    name: s.name ?? "Поставщик",
    subtitle: s.address ?? s.phone ?? "Поставщик USC",
    logo: (s.logo as string) || "/media/usc.svg",
  };
}

export async function fetchSuppliers(params?: { q?: string }) {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("search", params.q);

  const url = qs.toString() ? `/companies/suppliers/?${qs.toString()}` : "/companies/suppliers/";
  const now = Date.now();
  const cached = suppliersCache.get(url);

  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const pending = suppliersInFlight.get(url);
  if (pending) {
    return pending;
  }

  const request = api<{ count: number; results: SupplierApi[] }>(url, { auth: false })
    .then((data) => {
      const normalized = data.results.map(normalizeSupplier);
      suppliersCache.set(url, { data: normalized, expiresAt: Date.now() + SUPPLIERS_TTL_MS });
      return normalized;
    })
    .finally(() => {
      suppliersInFlight.delete(url);
    });

  suppliersInFlight.set(url, request);
  return request;
}
