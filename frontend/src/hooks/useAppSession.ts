import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";

import { bootstrapSession, logout as clearAuth, logoutAllRequest, logoutLocal } from "../api/auth";
import { hasAccessToken, isApiError, SESSION_EXPIRED_EVENT } from "../api/client";
import { fetchNotifications } from "../api/notifications";
import { fetchMe, type MeProfile } from "../api/profile";

type UseAppSessionOptions = {
  onSessionExpiredUiReset?: () => void;
};

type UseAppSessionResult = {
  authed: boolean;
  sessionBootstrapDone: boolean;
  profile: MeProfile | null;
  profileLoading: boolean;
  profileError: string | null;
  notificationCount: number;
  companyId: number | null;
  appRole: "buyer" | "supplier";
  setProfile: (next: MeProfile | null) => void;
  setProfileNonce: Dispatch<SetStateAction<number>>;
  setNotificationCount: Dispatch<SetStateAction<number>>;
  setCompanyId: Dispatch<SetStateAction<number | null>>;
  handleSessionExpired: () => void;
  handleAuthSuccess: () => void;
  handleLogout: () => Promise<void>;
  handleLogoutAll: () => Promise<void>;
  handleSwitchCompany: () => void;
};

export function useAppSession(options: UseAppSessionOptions = {}): UseAppSessionResult {
  const initialAuthed = hasAccessToken();
  const [authed, setAuthed] = useState(initialAuthed);
  const [sessionBootstrapDone, setSessionBootstrapDone] = useState(initialAuthed);
  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileNonce, setProfileNonce] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
  const [companyId, setCompanyId] = useState<number | null>(() => {
    const raw = localStorage.getItem("usc_company_id");
    if (!raw) return null;
    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
  });
  const [isSessionExpiring, setIsSessionExpiring] = useState(false);

  const appRole = useMemo<"buyer" | "supplier">(() => {
    const currentCompany = profile?.companies?.find((company) => company.company_id === companyId) ?? null;
    const currentCompanyType = String(currentCompany?.company_type || "").toUpperCase();
    return currentCompanyType === "SUPPLIER" ? "supplier" : "buyer";
  }, [companyId, profile?.companies]);

  const handleSessionExpired = useCallback(() => {
    if (isSessionExpiring) return;
    setIsSessionExpiring(true);
    logoutLocal();
    localStorage.removeItem("usc_company_id");
    localStorage.removeItem("usc_company_name");
    localStorage.removeItem("usc_app_role");
    setAuthed(false);
    setNotificationCount(0);
    setProfile(null);
    setProfileError(null);
    setProfileLoading(false);
    setCompanyId(null);
    options.onSessionExpiredUiReset?.();
    window.setTimeout(() => {
      setIsSessionExpiring(false);
    }, 50);
  }, [isSessionExpiring, options]);

  useEffect(() => {
    if (initialAuthed) return;
    let alive = true;
    bootstrapSession()
      .then((ok) => {
        if (!alive) return;
        setAuthed(ok);
      })
      .finally(() => {
        if (!alive) return;
        setSessionBootstrapDone(true);
      });
    return () => {
      alive = false;
    };
  }, [initialAuthed]);

  useEffect(() => {
    const onSessionExpired = () => handleSessionExpired();
    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired as EventListener);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired as EventListener);
  }, [handleSessionExpired]);

  useEffect(() => {
    if (!authed) {
      setProfile(null);
      setProfileError(null);
      setProfileLoading(false);
      return;
    }

    let alive = true;
    setProfileLoading(true);
    setProfileError(null);

    fetchMe()
      .then((data) => {
        if (!alive) return;
        setProfile(data);

        const storedRaw = localStorage.getItem("usc_company_id");
        const storedId = storedRaw ? Number(storedRaw) : null;
        const storedValid =
          storedId != null &&
          Number.isFinite(storedId) &&
          (data.companies || []).some((company) => company.company_id === storedId);

        if (data.companies?.length === 1) {
          const onlyCompany = data.companies[0];
          const onlyId = onlyCompany.company_id;
          setCompanyId(onlyId);
          localStorage.setItem("usc_company_id", String(onlyId));
          localStorage.setItem("usc_company_name", onlyCompany.name || "");
          return;
        }

        if (storedValid) {
          setCompanyId(storedId);
          const storedCompany = data.companies?.find((company) => company.company_id === storedId);
          if (storedCompany) localStorage.setItem("usc_company_name", storedCompany.name || "");
        } else {
          setCompanyId(null);
          localStorage.removeItem("usc_company_id");
          localStorage.removeItem("usc_company_name");
        }
      })
      .catch((error: unknown) => {
        if (!alive) return;
        if (isApiError(error) && error.status === 401) {
          handleSessionExpired();
          return;
        }
        setProfileError("Не удалось загрузить профиль");
        setProfile(null);
      })
      .finally(() => {
        if (!alive) return;
        setProfileLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [authed, profileNonce, handleSessionExpired]);

  useEffect(() => {
    if (!authed || !hasAccessToken()) {
      setNotificationCount(0);
      return;
    }

    let alive = true;
    let timer: number | null = null;
    const load = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      if (!hasAccessToken()) {
        alive = false;
        if (timer != null) window.clearInterval(timer);
        handleSessionExpired();
        return;
      }
      fetchNotifications(30)
        .then((data) => {
          if (!alive) return;
          setNotificationCount(data.unread_count ?? 0);
        })
        .catch((error: unknown) => {
          if (!alive) return;
          if (isApiError(error) && error.status === 401) {
            alive = false;
            if (timer != null) window.clearInterval(timer);
            handleSessionExpired();
            return;
          }
          setNotificationCount(0);
        });
    };

    load();
    timer = window.setInterval(load, 20000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        load();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      alive = false;
      if (timer != null) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [authed, handleSessionExpired]);

  const handleAuthSuccess = useCallback(() => {
    setSessionBootstrapDone(true);
    setAuthed(true);
  }, []);

  const handleLogout = useCallback(async () => {
    await clearAuth().catch(() => undefined);
    handleSessionExpired();
  }, [handleSessionExpired]);

  const handleLogoutAll = useCallback(async () => {
    await logoutAllRequest().catch(() => undefined);
    handleSessionExpired();
  }, [handleSessionExpired]);

  const handleSwitchCompany = useCallback(() => {
    setCompanyId(null);
    localStorage.removeItem("usc_company_id");
    localStorage.removeItem("usc_company_name");
  }, []);

  return {
    authed,
    sessionBootstrapDone,
    profile,
    profileLoading,
    profileError,
    notificationCount,
    companyId,
    appRole,
    setProfile,
    setProfileNonce,
    setNotificationCount,
    setCompanyId,
    handleSessionExpired,
    handleAuthSuccess,
    handleLogout,
    handleLogoutAll,
    handleSwitchCompany,
  };
}
