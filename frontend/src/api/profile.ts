import { api } from "./client";

export type CompanyMembership = {
  company_id: number;
  name: string;
  company_type?: string | null;
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
