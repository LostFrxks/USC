import { createSessionManager, type TokenStore } from "@usc/core";

function createTokenStore(initial: { access?: string | null; refresh?: string | null } = {}) {
  let access = initial.access ?? null;
  let refresh = initial.refresh ?? null;
  const store: TokenStore = {
    getAccess: jest.fn(async () => access),
    setAccess: jest.fn(async (token: string | null) => {
      access = token;
    }),
    getRefresh: jest.fn(async () => refresh),
    setRefresh: jest.fn(async (token: string | null) => {
      refresh = token;
    }),
    clear: jest.fn(async () => {
      access = null;
      refresh = null;
    }),
  };
  return { store, read: () => ({ access, refresh }) };
}

function createJsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    },
  } as Response;
}

describe("SessionManager", () => {
  it("bootstraps from refresh token and stores the new pair", async () => {
    const tokens = createTokenStore({ refresh: "refresh-1" });
    const manager = createSessionManager({
      baseUrl: "https://example.com/api",
      tokenStore: tokens.store,
      fetchImpl: jest.fn(async (url: string) => {
        expect(url).toBe("https://example.com/api/auth/token/refresh/");
        return createJsonResponse(200, { access: "access-2", refresh: "refresh-2" });
      }) as typeof fetch,
    });

    const ok = await manager.bootstrap();

    expect(ok).toBe(true);
    expect(tokens.store.setAccess).toHaveBeenCalledWith("access-2");
    expect(tokens.store.setRefresh).toHaveBeenCalledWith("refresh-2");
    expect(manager.getAccessToken()).toBe("access-2");
    expect(tokens.read()).toEqual({ access: "access-2", refresh: "refresh-2" });
  });

  it("clears tokens and emits unauthorized when refresh returns 401", async () => {
    const tokens = createTokenStore({ access: "old-access", refresh: "old-refresh" });
    const onSessionExpired = jest.fn();
    const manager = createSessionManager({
      baseUrl: "https://example.com/api",
      tokenStore: tokens.store,
      onSessionExpired,
      fetchImpl: jest.fn(async () => createJsonResponse(401, { detail: "Invalid refresh token" })) as typeof fetch,
    });

    const refreshed = await manager.refresh();

    expect(refreshed).toBeNull();
    expect(tokens.store.clear).toHaveBeenCalled();
    expect(onSessionExpired).toHaveBeenCalledWith("unauthorized");
    expect(tokens.read()).toEqual({ access: null, refresh: null });
  });

  it("uses stored access token before refresh", async () => {
    const tokens = createTokenStore({ access: "stored-access", refresh: "stored-refresh" });
    const fetchImpl = jest.fn();
    const manager = createSessionManager({
      baseUrl: "https://example.com/api",
      tokenStore: tokens.store,
      fetchImpl: fetchImpl as typeof fetch,
    });

    const token = await manager.ensureAccessToken();

    expect(token).toBe("stored-access");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("requests a phone code and returns dev fallback metadata", async () => {
    const tokens = createTokenStore();
    const manager = createSessionManager({
      baseUrl: "https://example.com/api",
      tokenStore: tokens.store,
      fetchImpl: jest.fn(async (url: string) => {
        expect(url).toBe("https://example.com/api/auth/phone/request/");
        return createJsonResponse(200, { sent: true, code: "123456", expires_in: 300 });
      }) as typeof fetch,
    });

    const result = await manager.requestPhoneCode("+996700000000");
    expect(result).toEqual({ sent: true, code: "123456", expiresIn: 300 });
  });

  it("verifies phone code and stores the token pair", async () => {
    const tokens = createTokenStore();
    const manager = createSessionManager({
      baseUrl: "https://example.com/api",
      tokenStore: tokens.store,
      fetchImpl: jest.fn(async (url: string) => {
        expect(url).toBe("https://example.com/api/auth/phone/verify/");
        return createJsonResponse(200, { access: "access-phone", refresh: "refresh-phone" });
      }) as typeof fetch,
    });

    await manager.verifyPhoneCode({ phone: "+996700000000", code: "123456", role: "buyer" });

    expect(tokens.store.setAccess).toHaveBeenCalledWith("access-phone");
    expect(tokens.store.setRefresh).toHaveBeenCalledWith("refresh-phone");
    expect(manager.getAccessToken()).toBe("access-phone");
  });

  it("requests password reset code", async () => {
    const tokens = createTokenStore();
    const manager = createSessionManager({
      baseUrl: "https://example.com/api",
      tokenStore: tokens.store,
      fetchImpl: jest.fn(async (url: string) => {
        expect(url).toBe("https://example.com/api/auth/password_reset/request/");
        return createJsonResponse(200, { sent: true, code: "654321", expires_in: 300 });
      }) as typeof fetch,
    });

    const result = await manager.requestPasswordResetCode("user@test.local");
    expect(result).toEqual({ sent: true, code: "654321", expiresIn: 300 });
  });

  it("confirms password reset", async () => {
    const tokens = createTokenStore();
    const manager = createSessionManager({
      baseUrl: "https://example.com/api",
      tokenStore: tokens.store,
      fetchImpl: jest.fn(async (url: string) => {
        expect(url).toBe("https://example.com/api/auth/password_reset/confirm/");
        return createJsonResponse(200, { reset: true, revoked_count: 2 });
      }) as typeof fetch,
    });

    const result = await manager.resetPassword({
      email: "user@test.local",
      code: "654321",
      newPassword: "newpass123",
    });

    expect(result).toEqual({ reset: true, revokedCount: 2 });
  });
});
