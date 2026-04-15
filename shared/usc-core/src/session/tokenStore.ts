export interface TokenStore {
  getAccess(): Promise<string | null>;
  setAccess(token: string | null): Promise<void>;
  getRefresh(): Promise<string | null>;
  setRefresh(token: string | null): Promise<void>;
  clear(): Promise<void>;
}
