import type { SessionProfile } from "../types/domain";
import type { Transport } from "../transport/contracts";

type ProfileApi = {
  fetchMe(): Promise<SessionProfile>;
  updateMe(payload: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    isCourierEnabled?: boolean;
    activeCompanyId?: number;
    companyName?: string;
    companyPhone?: string;
    companyAddress?: string;
  }): Promise<SessionProfile>;
};

function normalizeProfile(data: {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  role?: string | null;
  is_courier_enabled?: boolean;
  companies: Array<{
    company_id: number;
    name: string;
    company_type?: string | null;
    phone?: string | null;
    address?: string | null;
    role?: string | null;
  }>;
}): SessionProfile {
  return {
    id: data.id,
    email: data.email,
    firstName: data.first_name,
    lastName: data.last_name,
    phone: data.phone,
    role: data.role,
    isCourierEnabled: data.is_courier_enabled,
    companies: (data.companies ?? []).map((company) => ({
      companyId: company.company_id,
      name: company.name,
      companyType: company.company_type,
      phone: company.phone,
      address: company.address,
      role: company.role,
    })),
  };
}

export function createProfileApi(transport: Transport): ProfileApi {
  return {
    async fetchMe() {
      const data = await transport.request<{
        id: number;
        email: string;
        first_name: string;
        last_name: string;
        phone?: string | null;
        role?: string | null;
        is_courier_enabled?: boolean;
        companies: Array<{
          company_id: number;
          name: string;
          company_type?: string | null;
          phone?: string | null;
          address?: string | null;
          role?: string | null;
        }>;
      }>("/auth/me/", { auth: true });

      return normalizeProfile(data);
    },

    async updateMe(payload) {
      const data = await transport.request<{
        id: number;
        email: string;
        first_name: string;
        last_name: string;
        phone?: string | null;
        role?: string | null;
        is_courier_enabled?: boolean;
        companies: Array<{
          company_id: number;
          name: string;
          company_type?: string | null;
          phone?: string | null;
          address?: string | null;
          role?: string | null;
        }>;
      }>("/profile/me/", {
        method: "PATCH",
        auth: true,
        body: {
          first_name: payload.firstName,
          last_name: payload.lastName,
          phone: payload.phone,
          email: payload.email,
          is_courier_enabled: payload.isCourierEnabled,
          active_company_id: payload.activeCompanyId,
          company_name: payload.companyName,
          company_phone: payload.companyPhone,
          company_address: payload.companyAddress,
        },
      });

      return normalizeProfile(data);
    },
  };
}
