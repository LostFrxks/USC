import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import type { AppRole, CompanyMembership } from "@usc/core";
import { STORAGE_KEYS, getStoredJson, removeStoredValue, setStoredJson } from "@/storage/appStorage";
import { useSession } from "@/session/SessionProvider";

type SelectedCompanyContextValue = {
  companies: CompanyMembership[];
  buyerCompanies: CompanyMembership[];
  supplierCompanies: CompanyMembership[];
  activeCompany: CompanyMembership | null;
  activeCompanyId: number | null;
  appRole: AppRole;
  loading: boolean;
  hasCompanies: boolean;
  setActiveCompanyId(id: number): Promise<void>;
  clearSelection(): Promise<void>;
};

const SelectedCompanyContext = createContext<SelectedCompanyContextValue | null>(null);

export function SelectedCompanyProvider({ children }: PropsWithChildren) {
  const { profile, state } = useSession();
  const [activeCompanyId, setActiveCompanyIdState] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const companies = useMemo(() => profile?.companies ?? [], [profile?.companies]);
  const buyerCompanies = useMemo(
    () => companies.filter((company) => String(company.companyType || "").toUpperCase() === "BUYER"),
    [companies]
  );
  const supplierCompanies = useMemo(
    () => companies.filter((company) => String(company.companyType || "").toUpperCase() === "SUPPLIER"),
    [companies]
  );

  useEffect(() => {
    let mounted = true;

    async function resolveCompany() {
      if (state === "booting") return;
      if (!profile) {
        if (mounted) {
          setActiveCompanyIdState(null);
          setLoading(false);
        }
        return;
      }

      const stored = await getStoredJson<number>(STORAGE_KEYS.activeCompanyId);
      const validStored =
        typeof stored === "number" && companies.some((company) => company.companyId === stored);

      if (!mounted) return;

      if (companies.length === 1) {
        setActiveCompanyIdState(companies[0].companyId);
        await setStoredJson(STORAGE_KEYS.activeCompanyId, companies[0].companyId);
      } else if (validStored) {
        setActiveCompanyIdState(stored);
      } else {
        setActiveCompanyIdState(null);
        await removeStoredValue(STORAGE_KEYS.activeCompanyId);
      }

      setLoading(false);
    }

    setLoading(true);
    void resolveCompany();

    return () => {
      mounted = false;
    };
  }, [companies, profile, state]);

  const value = useMemo<SelectedCompanyContextValue>(() => ({
    companies,
    buyerCompanies,
    supplierCompanies,
    activeCompany: companies.find((company) => company.companyId === activeCompanyId) ?? null,
    activeCompanyId,
    appRole:
      String(companies.find((company) => company.companyId === activeCompanyId)?.companyType || "").toUpperCase() === "SUPPLIER"
        ? "supplier"
        : "buyer",
    loading,
    hasCompanies: companies.length > 0,
    async setActiveCompanyId(id: number) {
      setActiveCompanyIdState(id);
      await setStoredJson(STORAGE_KEYS.activeCompanyId, id);
    },
    async clearSelection() {
      setActiveCompanyIdState(null);
      await removeStoredValue(STORAGE_KEYS.activeCompanyId);
    },
  }), [activeCompanyId, buyerCompanies, companies, loading, supplierCompanies]);

  return <SelectedCompanyContext.Provider value={value}>{children}</SelectedCompanyContext.Provider>;
}

export function useSelectedCompany() {
  const context = useContext(SelectedCompanyContext);
  if (!context) {
    throw new Error("useSelectedCompany must be used inside SelectedCompanyProvider");
  }
  return context;
}
