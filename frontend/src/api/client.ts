import { API_BASE } from "../config";

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

function getToken(): string | null {
  return localStorage.getItem("usc_access_token");
}

export async function api<T>(
  path: string,
  opts?: {
    method?: HttpMethod;
    body?: unknown;
    auth?: boolean;
  }
): Promise<T> {
  const method = opts?.method ?? "GET";
  const auth = opts?.auth ?? false;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let detail = text;
    try {
      const parsed = JSON.parse(text) as { detail?: unknown };
      if (typeof parsed?.detail === "string") detail = parsed.detail;
      else if (parsed?.detail) detail = JSON.stringify(parsed.detail);
    } catch {
      // keep raw response text
    }
    throw new Error(`API ${method} ${path} -> ${res.status}: ${detail}`);
  }

  // если пустой ответ
  if (res.status === 204) return undefined as T;

  return (await res.json()) as T;
}
