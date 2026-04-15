import type { CompanyMembership } from "@usc/core";
import { classifyCompany, filterWorkspaceCompanies, groupWorkspaceCompanies, workspaceStats } from "@/screens/companyWorkspace";

const COMPANIES: CompanyMembership[] = [
  { companyId: 10, name: "Buyer A", companyType: "BUYER", address: "Bishkek" },
  { companyId: 20, name: "Supplier B", companyType: "SUPPLIER", phone: "+996700000000" },
  { companyId: 30, name: "Mixed C", companyType: null },
];

describe("company workspace helpers", () => {
  it("classifies companies by company type", () => {
    expect(classifyCompany(COMPANIES[0])).toBe("buyer");
    expect(classifyCompany(COMPANIES[1])).toBe("supplier");
    expect(classifyCompany(COMPANIES[2])).toBe("other");
  });

  it("filters workspace companies by search text", () => {
    expect(filterWorkspaceCompanies(COMPANIES, "bishkek").map((item) => item.companyId)).toEqual([10]);
  });

  it("groups workspace companies and puts active first", () => {
    const sections = groupWorkspaceCompanies(COMPANIES, 20);
    expect(sections.map((section) => section.key)).toEqual(["buyer", "supplier", "other"]);
    expect(sections[1].items[0].companyId).toBe(20);
  });

  it("summarizes workspace stats", () => {
    expect(workspaceStats(COMPANIES)).toEqual({ all: 3, buyer: 1, supplier: 1 });
  });
});
