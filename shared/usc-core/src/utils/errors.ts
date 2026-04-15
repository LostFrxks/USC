export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE" | "PUT";

export class ApiError extends Error {
  status: number;
  method: HttpMethod;
  path: string;
  detail: string;

  constructor(status: number, method: HttpMethod, path: string, detail: string) {
    super(`API ${method} ${path} -> ${status}: ${detail}`);
    this.name = "ApiError";
    this.status = status;
    this.method = method;
    this.path = path;
    this.detail = detail;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
