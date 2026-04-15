import { api, bootstrapSession, setAccessToken } from "./client";

type TokenPair = { access: string; refresh?: string };

function storeTokens(data: TokenPair) {
  setAccessToken(data.access);
  localStorage.removeItem("usc_refresh_token");
}

export async function login(email: string, password: string, captchaToken?: string) {
  const data = await api<TokenPair>("/auth/login/", {
    method: "POST",
    body: { email, password, ...(captchaToken ? { captcha_token: captchaToken } : {}) },
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
  captcha_token?: string;
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

export async function logoutRequest() {
  const refresh = localStorage.getItem("usc_refresh_token");
  await api<{ revoked: boolean }>("/auth/logout/", {
    method: "POST",
    body: refresh ? { refresh } : {},
  }).catch(() => undefined);
}

export async function logoutAllRequest() {
  await api<{ revoked_count: number }>("/auth/logout_all/", {
    method: "POST",
    auth: true,
  });
}

export function logoutLocal() {
  setAccessToken(null);
  localStorage.removeItem("usc_refresh_token");
}

export async function logout() {
  await logoutRequest();
  logoutLocal();
}

export { bootstrapSession };
