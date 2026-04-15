import type { CompanyMembership } from "@usc/core";

export type WorkspaceSection = {
  key: string;
  title: string;
  count: number;
  items: CompanyMembership[];
};

export function classifyCompany(company: CompanyMembership): "buyer" | "supplier" | "other" {
  const type = String(company.companyType || "").toUpperCase();
  if (type === "BUYER") return "buyer";
  if (type === "SUPPLIER") return "supplier";
  return "other";
}

function companySort(activeCompanyId: number | null) {
  return (a: CompanyMembership, b: CompanyMembership) => {
    if (a.companyId === activeCompanyId) return -1;
    if (b.companyId === activeCompanyId) return 1;
    return a.name.localeCompare(b.name);
  };
}

export function filterWorkspaceCompanies(companies: CompanyMembership[], query: string): CompanyMembership[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return companies;
  return companies.filter((company) => {
    const haystack = [company.name, company.companyType, company.address, company.phone, company.role]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalized);
  });
}

export function groupWorkspaceCompanies(companies: CompanyMembership[], activeCompanyId: number | null): WorkspaceSection[] {
  const grouped = {
    buyer: companies.filter((company) => classifyCompany(company) === "buyer").sort(companySort(activeCompanyId)),
    supplier: companies.filter((company) => classifyCompany(company) === "supplier").sort(companySort(activeCompanyId)),
    other: companies.filter((company) => classifyCompany(company) === "other").sort(companySort(activeCompanyId)),
  };

  return [
    { key: "buyer", title: "Buyer workspaces", count: grouped.buyer.length, items: grouped.buyer },
    { key: "supplier", title: "Supplier workspaces", count: grouped.supplier.length, items: grouped.supplier },
    { key: "other", title: "Other companies", count: grouped.other.length, items: grouped.other },
  ].filter((section) => section.items.length > 0);
}

export function workspaceStats(companies: CompanyMembership[]) {
  return companies.reduce(
    (acc, company) => {
      acc.all += 1;
      const bucket = classifyCompany(company);
      if (bucket === "buyer") acc.buyer += 1;
      if (bucket === "supplier") acc.supplier += 1;
      return acc;
    },
    { all: 0, buyer: 0, supplier: 0 }
  );
}
