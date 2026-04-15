import type { SessionManager } from "../session/sessionManager";
import type { RequestOptions, Transport } from "./contracts";
import { ApiError, type HttpMethod } from "../utils/errors";

type FetchLike = typeof fetch;

type CreateTransportOptions = {
  baseUrl: string;
  session: SessionManager;
  fetchImpl?: FetchLike;
};

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

export function createTransport(options: CreateTransportOptions): Transport {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/+$/, "");

  async function requestInternal<T>(path: string, requestOptions: RequestOptions | undefined, retried: boolean): Promise<T> {
    const method = requestOptions?.method ?? "GET";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(requestOptions?.headers ?? {}),
    };

    if (requestOptions?.auth) {
      const token = await options.session.ensureAccessToken();
      if (!token) {
        await options.session.clearExpiredSession("missing_token");
        throw new ApiError(401, method, path, "Missing access token");
      }
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers,
      body: requestOptions?.body == null ? undefined : JSON.stringify(requestOptions.body),
    });

    if (!response.ok) {
      if (requestOptions?.auth && response.status === 401 && !retried) {
        const refreshed = await options.session.refresh();
        if (refreshed) {
          return requestInternal<T>(path, requestOptions, true);
        }
        await options.session.clearExpiredSession("unauthorized");
      }
      throw new ApiError(response.status, method as HttpMethod, path, await readErrorDetail(response));
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  return {
    request<T>(path: string, requestOptions?: RequestOptions) {
      return requestInternal<T>(path, requestOptions, false);
    },
  };
}
