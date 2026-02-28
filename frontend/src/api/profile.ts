import { api } from "./client";

export type CompanyMembership = {
  company_id: number;
  name: string;
  company_type?: string | null;
  phone?: string | null;
  address?: string | null;
  role?: string | null;
};

export type MeProfile = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  role?: string | null;
  is_courier_enabled?: boolean;
  companies: CompanyMembership[];
};

export async function fetchMe() {
  return api<MeProfile>("/auth/me/", { auth: true });
}

export type UpdateMePayload = {
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  active_company_id?: number;
  company_name?: string;
  company_phone?: string;
  company_address?: string;
};

export async function updateMe(payload: UpdateMePayload) {
  return api<MeProfile>("/profile/me/", {
    method: "PATCH",
    body: payload,
    auth: true,
  });
}
