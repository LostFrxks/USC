import type { CompanyMembership, SupplierSummary } from "../types/domain";
import type { Transport } from "../transport/contracts";

type CompaniesApi = {
  listCompanies(params?: { search?: string; limit?: number; offset?: number }): Promise<CompanyMembership[]>;
  listSuppliers(params?: { q?: string; limit?: number; offset?: number }): Promise<SupplierSummary[]>;
};

export function createCompaniesApi(transport: Transport): CompaniesApi {
  return {
    async listCompanies(params) {
      const qs = new URLSearchParams();
      if (params?.search) qs.set("search", params.search);
      if (params?.limit != null) qs.set("limit", String(params.limit));
      if (params?.offset != null) qs.set("offset", String(params.offset));
      const url = qs.toString() ? `/companies/?${qs.toString()}` : "/companies/";
      const data = await transport.request<{ results: Array<{ id: number; name: string; company_type?: string | null; phone?: string | null; address?: string | null }> }>(url, {
        auth: true,
      });
      return (data.results ?? []).map((item) => ({
        companyId: item.id,
        name: item.name,
        companyType: item.company_type,
        phone: item.phone,
        address: item.address,
      }));
    },

    async listSuppliers(params) {
      const qs = new URLSearchParams();
      if (params?.q) qs.set("search", params.q);
      if (params?.limit != null) qs.set("limit", String(params.limit));
      if (params?.offset != null) qs.set("offset", String(params.offset));
      const url = qs.toString() ? `/companies/suppliers/?${qs.toString()}` : "/companies/suppliers/";
      const data = await transport.request<{ results: Array<{ id: number | string; name: string; address?: string; phone?: string; logo?: string | null }> }>(url);
      return (data.results ?? []).map((supplier) => ({
        id: String(supplier.id),
        name: supplier.name ?? "Supplier",
        subtitle: supplier.address ?? supplier.phone ?? "USC supplier",
        logo: supplier.logo ?? null,
      }));
    },
  };
}
