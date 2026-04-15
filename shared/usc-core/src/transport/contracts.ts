import type { HttpMethod } from "../utils/errors";

export type RequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  auth?: boolean;
  headers?: Record<string, string>;
};

export interface Transport {
  request<T>(path: string, options?: RequestOptions): Promise<T>;
}
