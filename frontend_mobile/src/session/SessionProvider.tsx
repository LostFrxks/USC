import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import {
  createAiChatApi,
  createAnalyticsApi,
  createCatalogApi,
  createCompaniesApi,
  createDeliveriesApi,
  createNotificationsApi,
  createOrdersApi,
  createProfileApi,
  createSessionManager,
  createTransport,
  type SessionProfile,
  type SessionManager,
} from "@usc/core";
import { API_BASE } from "@/config/env";
import { secureTokenStore } from "@/storage/secureTokenStore";

type SessionState = "booting" | "authenticated" | "anonymous";

type CoreServices = {
  sessionManager: SessionManager;
  profileApi: ReturnType<typeof createProfileApi>;
  companiesApi: ReturnType<typeof createCompaniesApi>;
  catalogApi: ReturnType<typeof createCatalogApi>;
  ordersApi: ReturnType<typeof createOrdersApi>;
  deliveriesApi: ReturnType<typeof createDeliveriesApi>;
  notificationsApi: ReturnType<typeof createNotificationsApi>;
  analyticsApi: ReturnType<typeof createAnalyticsApi>;
  aiChatApi: ReturnType<typeof createAiChatApi>;
};

type SessionContextValue = {
  state: SessionState;
  profile: SessionProfile | null;
  profileError: string | null;
  services: CoreServices;
  bootstrap(): Promise<void>;
  refreshProfile(): Promise<SessionProfile | null>;
  login(email: string, password: string, captchaToken?: string): Promise<void>;
  requestEmailCode(email: string): Promise<{ sent: boolean; code?: string; expiresIn?: number }>;
  requestPhoneCode(phone: string): Promise<{ sent: boolean; code?: string; expiresIn?: number }>;
  requestPasswordResetCode(email: string): Promise<{ sent: boolean; code?: string; expiresIn?: number }>;
  loginWithPhoneCode(payload: { phone: string; code: string; captchaToken?: string }): Promise<void>;
  registerBuyer(payload: {
    email: string;
    password: string;
    code: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  }): Promise<void>;
  registerBuyerWithPhone(payload: {
    phone: string;
    code: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  }): Promise<void>;
  resetPassword(payload: { email: string; code: string; newPassword: string; captchaToken?: string }): Promise<{ reset: boolean; revokedCount: number }>;
  logout(): Promise<void>;
  logoutAll(): Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<SessionState>("booting");
  const [profile, setProfile] = useState<SessionProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const sessionManager = useMemo(
    () =>
      createSessionManager({
        baseUrl: API_BASE,
        tokenStore: secureTokenStore,
        onSessionExpired: async () => {
          setProfile(null);
          setProfileError(null);
          setState("anonymous");
        },
      }),
    []
  );

  const services = useMemo<CoreServices>(() => {
    const transport = createTransport({
      baseUrl: API_BASE,
      session: sessionManager,
    });
    return {
      sessionManager,
      profileApi: createProfileApi(transport),
      companiesApi: createCompaniesApi(transport),
      catalogApi: createCatalogApi(transport),
      ordersApi: createOrdersApi(transport),
      deliveriesApi: createDeliveriesApi(transport),
      notificationsApi: createNotificationsApi(transport),
      analyticsApi: createAnalyticsApi(transport, {
        baseUrl: API_BASE,
        ensureAccessToken: () => sessionManager.ensureAccessToken(),
      }),
      aiChatApi: createAiChatApi(transport),
    };
  }, [sessionManager]);

  const refreshProfile = useCallback(async () => {
    try {
      const nextProfile = await services.profileApi.fetchMe();
      setProfile(nextProfile);
      setProfileError(null);
      setState("authenticated");
      return nextProfile;
    } catch (error) {
      setProfile(null);
      setProfileError(error instanceof Error ? error.message : "Failed to load profile.");
      setState("anonymous");
      return null;
    }
  }, [services.profileApi]);

  const bootstrap = useCallback(async () => {
    setState("booting");
    setProfileError(null);
    const ok = await services.sessionManager.bootstrap();
    if (!ok) {
      setProfile(null);
      setState("anonymous");
      return;
    }
    const nextProfile = await refreshProfile();
    if (!nextProfile) {
      await services.sessionManager.clearExpiredSession("bootstrap_failed");
    }
  }, [refreshProfile, services.sessionManager]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const login = useCallback(async (email: string, password: string, captchaToken?: string) => {
    await services.sessionManager.loginWithPassword({
      email: email.trim().toLowerCase(),
      password,
      captchaToken: captchaToken?.trim() || undefined,
    });
    await refreshProfile();
  }, [refreshProfile, services.sessionManager]);

  const requestEmailCode = useCallback((email: string) => {
    return services.sessionManager.requestEmailCode(email.trim().toLowerCase());
  }, [services.sessionManager]);

  const requestPhoneCode = useCallback((phone: string) => {
    return services.sessionManager.requestPhoneCode(phone.trim());
  }, [services.sessionManager]);

  const requestPasswordResetCode = useCallback((email: string) => {
    return services.sessionManager.requestPasswordResetCode(email.trim().toLowerCase());
  }, [services.sessionManager]);

  const loginWithPhoneCode = useCallback(async (payload: { phone: string; code: string; captchaToken?: string }) => {
    await services.sessionManager.verifyPhoneCode({
      phone: payload.phone.trim(),
      code: payload.code.trim(),
      role: "buyer",
      captchaToken: payload.captchaToken?.trim() || undefined,
    });
    await refreshProfile();
  }, [refreshProfile, services.sessionManager]);

  const registerBuyer = useCallback(async (payload: {
    email: string;
    password: string;
    code: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  }) => {
    await services.sessionManager.registerEmail({
      email: payload.email.trim().toLowerCase(),
      password: payload.password,
      code: payload.code.trim(),
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: payload.phone,
      role: "buyer",
    });
    await services.sessionManager.loginWithPassword({
      email: payload.email.trim().toLowerCase(),
      password: payload.password,
    });
    await refreshProfile();
  }, [refreshProfile, services.sessionManager]);

  const registerBuyerWithPhone = useCallback(async (payload: {
    phone: string;
    code: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  }) => {
    await services.sessionManager.verifyPhoneCode({
      phone: payload.phone.trim(),
      code: payload.code.trim(),
      email: payload.email?.trim() || undefined,
      firstName: payload.firstName,
      lastName: payload.lastName,
      role: "buyer",
      captchaToken: undefined,
    });
    await refreshProfile();
  }, [refreshProfile, services.sessionManager]);

  const resetPassword = useCallback((payload: { email: string; code: string; newPassword: string; captchaToken?: string }) => {
    return services.sessionManager.resetPassword({
      email: payload.email.trim().toLowerCase(),
      code: payload.code.trim(),
      newPassword: payload.newPassword,
      captchaToken: payload.captchaToken?.trim() || undefined,
    });
  }, [services.sessionManager]);

  const logout = useCallback(async () => {
    await services.sessionManager.logout();
    setProfile(null);
    setProfileError(null);
    setState("anonymous");
  }, [services.sessionManager]);

  const logoutAll = useCallback(async () => {
    await services.sessionManager.logoutAll();
    setProfile(null);
    setProfileError(null);
    setState("anonymous");
  }, [services.sessionManager]);

  const value = useMemo<SessionContextValue>(() => ({
    state,
    profile,
    profileError,
    services,
    bootstrap,
    refreshProfile,
    login,
    requestEmailCode,
    requestPhoneCode,
    requestPasswordResetCode,
    loginWithPhoneCode,
    registerBuyer,
    registerBuyerWithPhone,
    resetPassword,
    logout,
    logoutAll,
  }), [bootstrap, login, loginWithPhoneCode, logout, logoutAll, profile, profileError, refreshProfile, registerBuyer, registerBuyerWithPhone, requestEmailCode, requestPasswordResetCode, requestPhoneCode, resetPassword, services, state]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used inside SessionProvider");
  }
  return context;
}
