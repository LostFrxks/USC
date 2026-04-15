import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, ApiError, bootstrapSession, hasAccessToken, SESSION_EXPIRED_EVENT, setAccessToken } from "./client";

describe("api client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("refreshes token on first 401 and retries request", async () => {
    setAccessToken("old-access");

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access: "new-access" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const result = await api<{ ok: boolean }>("/orders/", { auth: true });

    expect(result.ok).toBe(true);
    expect(hasAccessToken()).toBe(true);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ credentials: "include" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("throws ApiError and emits session-expired after failed refresh", async () => {
    setAccessToken("old-access");

    const events: Event[] = [];
    const handler = (ev: Event) => events.push(ev);
    window.addEventListener(SESSION_EXPIRED_EVENT, handler);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }))
      .mockResolvedValueOnce(new Response("refresh-failed", { status: 401 }));

    vi.stubGlobal("fetch", fetchMock);

    let caught: unknown;
    try {
      await api("/profile/me/", { auth: true });
    } catch (error) {
      caught = error;
    }

    window.removeEventListener(SESSION_EXPIRED_EVENT, handler);
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(401);
    expect(events.length).toBeGreaterThan(0);
  });

  it("uses single refresh request for concurrent 401 responses", async () => {
    setAccessToken("old-access");

    let protectedCalls = 0;
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith("/orders/") || url.endsWith("/profile/me/")) {
        protectedCalls += 1;
        if (protectedCalls <= 2) {
          return Promise.resolve(new Response("unauthorized", { status: 401 }));
        }
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      if (url.endsWith("/auth/token/refresh/")) {
        return Promise.resolve(
          new Response(JSON.stringify({ access: "new-access" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      return Promise.resolve(new Response("not-found", { status: 404 }));
    });

    vi.stubGlobal("fetch", fetchMock);

    const [a, b] = await Promise.all([
      api<{ ok: boolean }>("/orders/", { auth: true }),
      api<{ ok: boolean }>("/profile/me/", { auth: true }),
    ]);

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    const refreshCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith("/auth/token/refresh/")
    );
    expect(refreshCalls).toHaveLength(1);
    expect(refreshCalls[0]?.[1]).toMatchObject({ credentials: "include" });
  });

  it("bootstraps session from refresh cookie when access token is missing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access: "bootstrapped-access" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(bootstrapSession()).resolves.toBe(true);
    expect(hasAccessToken()).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/auth\/token\/refresh\/$/),
      expect.objectContaining({ credentials: "include" })
    );
  });
});
