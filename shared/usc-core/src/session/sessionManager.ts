import { ApiError, type HttpMethod } from "../utils/errors";
import type { TokenStore } from "./tokenStore";

type FetchLike = typeof fetch;

type LoginPayload = {
  email: string;
  password: string;
  captchaToken?: string;
};

type RegisterEmailPayload = {
  email: string;
  password: string;
  code: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
};

type RegisterResponse = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role?: string;
};

type PhoneVerifyPayload = {
  phone: string;
  code: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  captchaToken?: string;
};

type TokenPair = {
  access: string;
  refresh?: string;
};

type SessionExpiredReason = "bootstrap_failed" | "missing_token" | "unauthorized";

export interface SessionManager {
  bootstrap(): Promise<boolean>;
  loginWithPassword(payload: LoginPayload): Promise<void>;
  requestEmailCode(email: string): Promise<{ sent: boolean; code?: string; expiresIn?: number }>;
  requestPhoneCode(phone: string): Promise<{ sent: boolean; code?: string; expiresIn?: number }>;
  requestPasswordResetCode(email: string): Promise<{ sent: boolean; code?: string; expiresIn?: number }>;
  registerEmail(payload: RegisterEmailPayload): Promise<RegisterResponse>;
  verifyPhoneCode(payload: PhoneVerifyPayload): Promise<void>;
  resetPassword(payload: { email: string; code: string; newPassword: string; captchaToken?: string }): Promise<{ reset: boolean; revokedCount: number }>;
  ensureAccessToken(): Promise<string | null>;
  refresh(): Promise<string | null>;
  getAccessToken(): string | null;
  clearExpiredSession(reason?: SessionExpiredReason): Promise<void>;
  logout(): Promise<void>;
  logoutAll(): Promise<void>;
}

type SessionManagerOptions = {
  baseUrl: string;
  tokenStore: TokenStore;
  fetchImpl?: FetchLike;
  onSessionExpired?: (reason: SessionExpiredReason) => void | Promise<void>;
};

function buildUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}

async function readErrorDetail(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  try {
    const parsed = JSON.parse(text) as { detail?: unknown };
    if (typeof parsed.detail === "string") return parsed.detail;
    if (parsed.detail != null) return JSON.stringify(parsed.detail);
  } catch {
    // noop
  }
  return text || `HTTP ${response.status}`;
}

export function createSessionManager(options: SessionManagerOptions): SessionManager {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const tokenStore = options.tokenStore;
  let accessToken: string | null = null;
  let refreshInFlight: Promise<string | null> | null = null;

  async function emitSessionExpired(reason: SessionExpiredReason) {
    await options.onSessionExpired?.(reason);
  }

  async function clearTokens(reason?: SessionExpiredReason) {
    accessToken = null;
    refreshInFlight = null;
    await tokenStore.clear();
    if (reason) {
      await emitSessionExpired(reason);
    }
  }

  async function rawRequest<T>(path: string, method: HttpMethod, body?: unknown, headers?: Record<string, string>): Promise<T> {
    const response = await fetchImpl(buildUrl(baseUrl, path), {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(headers ?? {}),
      },
      body: body == null ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
      throw new ApiError(response.status, method, path, await readErrorDetail(response));
    }

    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }

  async function storePair(pair: TokenPair) {
    accessToken = pair.access;
    await tokenStore.setAccess(pair.access);
    if (pair.refresh) {
      await tokenStore.setRefresh(pair.refresh);
    }
  }

  async function refresh(): Promise<string | null> {
    if (refreshInFlight) return refreshInFlight;

    refreshInFlight = (async () => {
      const refreshToken = await tokenStore.getRefresh();
      if (!refreshToken) return null;
      try {
        const pair = await rawRequest<TokenPair>("/auth/token/refresh/", "POST", { refresh: refreshToken });
        await storePair(pair);
        return pair.access;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await clearTokens("unauthorized");
          return null;
        }
        throw error;
      }
    })().finally(() => {
      refreshInFlight = null;
    });

    return refreshInFlight;
  }

  async function ensureAccessToken(): Promise<string | null> {
    if (accessToken) return accessToken;
    const storedAccess = await tokenStore.getAccess();
    if (storedAccess) {
      accessToken = storedAccess;
      return accessToken;
    }
    return refresh();
  }

  async function withAuth(path: string, method: HttpMethod, body?: unknown): Promise<void> {
    const token = await ensureAccessToken();
    if (!token) {
      await clearTokens("missing_token");
      throw new ApiError(401, method, path, "Missing access token");
    }
    try {
      await rawRequest<void>(path, method, body, { Authorization: `Bearer ${token}` });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        const refreshed = await refresh();
        if (!refreshed) {
          await clearTokens("unauthorized");
          throw error;
        }
        await rawRequest<void>(path, method, body, { Authorization: `Bearer ${refreshed}` });
        return;
      }
      throw error;
    }
  }

  return {
    async bootstrap() {
      accessToken = await tokenStore.getAccess();
      const refreshToken = await tokenStore.getRefresh();
      if (!accessToken && !refreshToken) return false;
      if (refreshToken) {
        const refreshed = await refresh().catch(async () => {
          await clearTokens("bootstrap_failed");
          return null;
        });
        return Boolean(refreshed);
      }
      return Boolean(accessToken);
    },

    async loginWithPassword(payload) {
      const pair = await rawRequest<TokenPair>("/auth/login/", "POST", {
        email: payload.email,
        password: payload.password,
        captcha_token: payload.captchaToken,
      });
      await storePair(pair);
    },

    async requestEmailCode(email) {
      const result = await rawRequest<{ sent: boolean; code?: string; expires_in?: number }>("/auth/email/request/", "POST", {
        email,
      });
      return {
        sent: result.sent,
        code: result.code,
        expiresIn: result.expires_in,
      };
    },

    async requestPhoneCode(phone) {
      const result = await rawRequest<{ sent: boolean; code?: string; expires_in?: number }>("/auth/phone/request/", "POST", {
        phone,
      });
      return {
        sent: result.sent,
        code: result.code,
        expiresIn: result.expires_in,
      };
    },

    async requestPasswordResetCode(email) {
      const result = await rawRequest<{ sent: boolean; code?: string; expires_in?: number }>("/auth/password_reset/request/", "POST", {
        email,
      });
      return {
        sent: result.sent,
        code: result.code,
        expiresIn: result.expires_in,
      };
    },

    async registerEmail(payload) {
      const result = await rawRequest<{
        id: number;
        email: string;
        first_name: string;
        last_name: string;
        phone?: string;
        role?: string;
      }>("/auth/register/", "POST", {
        email: payload.email,
        password: payload.password,
        code: payload.code,
        phone: payload.phone,
        first_name: payload.firstName,
        last_name: payload.lastName,
        role: payload.role,
      });
      return {
        id: result.id,
        email: result.email,
        first_name: result.first_name,
        last_name: result.last_name,
        phone: result.phone,
        role: result.role,
      };
    },

    async verifyPhoneCode(payload) {
      const pair = await rawRequest<TokenPair>("/auth/phone/verify/", "POST", {
        phone: payload.phone,
        code: payload.code,
        email: payload.email,
        first_name: payload.firstName,
        last_name: payload.lastName,
        role: payload.role,
        captcha_token: payload.captchaToken,
      });
      await storePair(pair);
    },

    async resetPassword(payload) {
      const result = await rawRequest<{ reset: boolean; revoked_count: number }>("/auth/password_reset/confirm/", "POST", {
        email: payload.email,
        code: payload.code,
        new_password: payload.newPassword,
        captcha_token: payload.captchaToken,
      });
      return {
        reset: result.reset,
        revokedCount: result.revoked_count ?? 0,
      };
    },

    ensureAccessToken,
    refresh,

    getAccessToken() {
      return accessToken;
    },

    async clearExpiredSession(reason = "unauthorized") {
      await clearTokens(reason);
    },

    async logout() {
      const refreshToken = await tokenStore.getRefresh();
      try {
        await rawRequest("/auth/logout/", "POST", refreshToken ? { refresh: refreshToken } : {});
      } catch {
        // ignore logout transport errors and clear local state anyway
      }
      await clearTokens();
    },

    async logoutAll() {
      try {
        await withAuth("/auth/logout_all/", "POST");
      } catch {
        // ignore and clear local session
      }
      await clearTokens();
    },
  };
}
