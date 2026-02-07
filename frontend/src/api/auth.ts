import { api } from "./client";

type TokenPair = { access: string; refresh?: string };

function storeTokens(data: TokenPair) {
  localStorage.setItem("usc_access_token", data.access);
  if (data.refresh) localStorage.setItem("usc_refresh_token", data.refresh);
}

export async function login(email: string, password: string) {
  const data = await api<TokenPair>("/auth/login/", {
    method: "POST",
    body: { email, password },
  });
  storeTokens(data);
}

export async function registerEmail(payload: {
  email: string;
  password: string;
  code: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
}) {
  return api<{ id: number } & { email: string }>("/auth/register/", {
    method: "POST",
    body: payload,
  });
}

export async function requestPhoneCode(phone: string) {
  return api<{ sent: boolean; code?: string; expires_in?: number }>("/auth/phone/request/", {
    method: "POST",
    body: { phone },
  });
}

export async function verifyPhoneCode(payload: {
  phone: string;
  code: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
}) {
  const data = await api<TokenPair>("/auth/phone/verify/", {
    method: "POST",
    body: payload,
  });
  storeTokens(data);
}

export async function requestEmailCode(email: string) {
  return api<{ sent: boolean; code?: string; expires_in?: number }>("/auth/email/request/", {
    method: "POST",
    body: { email },
  });
}

export async function verifyEmailCode(payload: {
  email: string;
  code: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  phone?: string;
}) {
  const data = await api<TokenPair>("/auth/email/verify/", {
    method: "POST",
    body: payload,
  });
  storeTokens(data);
}

export function logout() {
  localStorage.removeItem("usc_access_token");
  localStorage.removeItem("usc_refresh_token");
}
