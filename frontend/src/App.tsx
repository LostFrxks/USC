import { useCallback, useEffect, useMemo, useState } from "react";
import HomeScreen from "./screens/HomeScreen";
import SearchScreen from "./screens/SearchScreen";
import CartScreen from "./screens/CartScreen";
import ProfileScreen from "./screens/ProfileScreen";
import SupplierScreen from "./screens/SupplierScreen";
import OrdersScreen from "./screens/OrdersScreen";
import AuthScreen from "./screens/AuthScreen";
import AnalyticsScreen from "./screens/AnalyticsScreen";
import CompanyPickerScreen from "./screens/CompanyPickerScreen";
import PublicationsScreen from "./screens/PublicationsScreen";
import ProfileEditScreen from "./screens/ProfileEditScreen";
import NotificationsScreen from "./screens/NotificationsScreen";
import DeliveriesScreen from "./screens/DeliveriesScreen";
import AboutScreen from "./screens/AboutScreen";
import HelpScreen from "./screens/HelpScreen";
import FaqScreen from "./screens/FaqScreen";
import AIChatScreen from "./screens/AIChatScreen";
import OnboardingOverlay from "./onboarding/OnboardingOverlay";
import { ONBOARDING_STEPS } from "./onboarding/steps";
import { useOnboarding } from "./onboarding/useOnboarding";
import TabBar, { type TabKey } from "./ui/TabBar";
import { Toast } from "./ui/Toast";
import { Drawer } from "./ui/Drawer";
import { useCart } from "./hooks/useCart";
import { useToast } from "./hooks/useToast";
import type { Product, Screen } from "./types";
import type { Supplier } from "./api/suppliers";
import { useAppSession } from "./hooks/useAppSession";
import { hasAccessToken } from "./api/client";

const TAB_ORDER: TabKey[] = ["home", "cart", "analytics", "ai", "profile"];

export default function App() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [tabTransitionDir, setTabTransitionDir] = useState<"forward" | "backward">("forward");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerScreen, setDrawerScreen] = useState<Screen | null>(null);
  const [companyPickerOpen, setCompanyPickerOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [focusOrderId, setFocusOrderId] = useState<number | null>(null);
  const [supplierView, setSupplierView] = useState<{ id: string; name: string } | null>(null);
  const [searchPreset, setSearchPreset] = useState<{ categoryId: number | null }>({ categoryId: null });
  const [cartCheckoutOpen, setCartCheckoutOpen] = useState(false);
  const [companyPickerRoleFilter, setCompanyPickerRoleFilter] = useState<"buyer" | "supplier" | null>(null);
  const [tourTargetFound, setTourTargetFound] = useState(false);
  const [homeCategoryTouched, setHomeCategoryTouched] = useState(false);
  const [aiOnboardingAnswered, setAiOnboardingAnswered] = useState(false);

  const [splashAnimationDone, setSplashAnimationDone] = useState(() => !hasAccessToken());
  const resetUiAfterSessionExpiry = useCallback(() => {
    setCompanyPickerOpen(false);
    setCompanyPickerRoleFilter(null);
    setDrawerOpen(false);
    setDrawerScreen(null);
    setOrdersOpen(false);
    setSupplierView(null);
  }, []);
  const {
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
  } = useAppSession({ onSessionExpiredUiReset: resetUiAfterSessionExpiry });

  useEffect(() => {
    if (!authed) {
      setSplashAnimationDone(true);
      return;
    }
    setSplashAnimationDone(false);
    const t = setTimeout(() => setSplashAnimationDone(true), 2200);
    return () => clearTimeout(t);
  }, [authed]);

  const cart = useCart();
  const cartItems = useMemo(() => cart.items, [cart.items]);
  const currentCompany = profile?.companies?.find((c) => c.company_id === companyId) ?? null;
  const currentCompanyName = currentCompany?.name ?? null;
  const currentCompletedOrders = typeof currentCompany?.completed_orders === "number" ? currentCompany.completed_orders : 0;

  const keepSplashVisible = authed && !splashAnimationDone;
  const onboardingContext = useMemo(() => {
    if (!profile || companyId == null) return null;
    const userId = Number(profile.id);
    if (!Number.isFinite(userId) || userId <= 0) return null;
    return {
      userId,
      companyId: Number(companyId),
      role: appRole,
    };
  }, [appRole, companyId, profile]);

  const onboardingEnabled =
    authed &&
    !!profile &&
    companyId != null &&
    !profileLoading &&
    !companyPickerOpen &&
    !profileError &&
    !keepSplashVisible;

  const onboarding = useOnboarding({
    enabled: onboardingEnabled,
    context: onboardingContext,
    stepsCount: ONBOARDING_STEPS.length,
  });

  const onboardingStep = onboarding.isRunning ? ONBOARDING_STEPS[onboarding.stepIndex] ?? null : null;
  const onboardingCartDemoMode =
    onboarding.isRunning &&
    (onboardingStep?.id === "tab_cart" || onboardingStep?.id === "cart_checkout" || onboardingStep?.id === "checkout_map");
  const onboardingAiPromptMode = onboarding.isRunning && onboardingStep?.id === "ai_assistant";

  const onboardingStepCompleted = useMemo(() => {
    if (!onboardingStep) return false;
    if (onboardingStep.id === "ai_assistant") return activeTab === "ai" && aiOnboardingAnswered;
    if (onboardingStep.mode !== "interaction_required") return true;
    if (onboardingStep.id === "open_drawer") return drawerOpen;
    if (onboardingStep.id === "home_category") return homeCategoryTouched;
    if (onboardingStep.id === "tab_cart") return activeTab === "cart";
    if (onboardingStep.id === "cart_checkout") return activeTab === "cart" && cartCheckoutOpen;
    if (onboardingStep.id === "tab_analytics") return activeTab === "analytics";
    if (onboardingStep.id === "tab_ai") return activeTab === "ai";
    if (onboardingStep.id === "tab_profile") return activeTab === "profile";
    return false;
  }, [activeTab, aiOnboardingAnswered, cartCheckoutOpen, drawerOpen, homeCategoryTouched, onboardingStep]);

  const onboardingCanGoNext = useMemo(() => {
    if (!onboardingStep) return false;
    const targetMissing = !!onboardingStep.targetSelector && !tourTargetFound;
    if (onboardingStep.id === "ai_assistant") return onboardingStepCompleted || targetMissing;
    if (onboardingStep.mode !== "interaction_required") return true;
    return onboardingStepCompleted || targetMissing;
  }, [onboardingStep, onboardingStepCompleted, tourTargetFound]);

  function addToCart(product: Product) {
    cart.add(product);
  }

  function inc(productId: string) {
    const it = cart.items.find((x) => x.product.id === productId);
    cart.setQty(productId, (it?.qty ?? 0) + 1);
  }

  function dec(productId: string) {
    const it = cart.items.find((x) => x.product.id === productId);
    const next = (it?.qty ?? 0) - 1;
    if (next <= 0) cart.remove(productId);
    else cart.setQty(productId, next);
  }

  const openDrawer = () => setDrawerOpen(true);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const closeCompanyPicker = useCallback(() => {
    setCompanyPickerOpen(false);
    setCompanyPickerRoleFilter(null);
  }, []);
  const persistCompanySelection = useCallback(
    (id: number) => {
      if (!profile) return;
      const selected = profile.companies?.find((company) => company.company_id === id) ?? null;
      setCompanyId(id);
      localStorage.setItem("usc_company_id", String(id));
      if (selected?.name) localStorage.setItem("usc_company_name", selected.name);
      else localStorage.removeItem("usc_company_name");
    },
    [profile, setCompanyId]
  );
  const openCompanyPicker = useCallback((roleFilter: "buyer" | "supplier" | null = null) => {
    setCompanyPickerRoleFilter(roleFilter);
    setCompanyPickerOpen(true);
  }, []);
  const handleOpenCompanyPicker = useCallback(() => {
    setDrawerOpen(false);
    openCompanyPicker(null);
  }, [openCompanyPicker]);
  const requestRoleSwitch = useCallback(
    (nextRole: "buyer" | "supplier") => {
      if (!profile) return;
      const expectedType = nextRole === "supplier" ? "SUPPLIER" : "BUYER";
      const currentType = String(currentCompany?.company_type || "").toUpperCase();
      if (currentType === expectedType) {
        closeDrawer();
        return;
      }
      const candidates = (profile.companies || []).filter(
        (company) => String(company.company_type || "").toUpperCase() === expectedType
      );
      if (candidates.length === 0) {
        toast.show(
          nextRole === "supplier" ? "Для этого аккаунта нет компаний поставщика." : "Для этого аккаунта нет компаний покупателя.",
          "error"
        );
        return;
      }
      if (candidates.length === 1) {
        persistCompanySelection(candidates[0].company_id);
        closeCompanyPicker();
        closeDrawer();
        return;
      }
      closeDrawer();
      openCompanyPicker(nextRole);
    },
    [closeCompanyPicker, closeDrawer, currentCompany?.company_type, openCompanyPicker, persistCompanySelection, profile, toast]
  );

  const goTab = useCallback((tab: TabKey) => {
    setOrdersOpen(false);
    setFocusOrderId(null);
    setSupplierView(null);
    setDrawerScreen(null);

    if (tab !== activeTab) {
      const fromIndex = TAB_ORDER.indexOf(activeTab);
      const toIndex = TAB_ORDER.indexOf(tab);
      if (fromIndex >= 0 && toIndex >= 0) {
        setTabTransitionDir(toIndex > fromIndex ? "forward" : "backward");
      }
    }
    setActiveTab(tab);
    if (tab === "search") setSearchPreset({ categoryId: null });
    closeDrawer();
  }, [activeTab, closeDrawer]);

  useEffect(() => {
    setTourTargetFound(false);
  }, [onboardingStep?.id]);

  useEffect(() => {
    if (onboardingStep?.id === "ai_assistant") return;
    setAiOnboardingAnswered(false);
  }, [onboardingStep?.id]);

  useEffect(() => {
    setHomeCategoryTouched(false);
  }, [onboardingContext?.userId, onboardingContext?.companyId, onboardingContext?.role]);

  useEffect(() => {
    if (!onboarding.isRunning || !onboardingStep) return;
    if (onboardingStep.screen && activeTab !== onboardingStep.screen) {
      goTab(onboardingStep.screen);
      return;
    }
    if (onboardingStep.id !== "open_drawer" && drawerOpen) {
      closeDrawer();
    }
  }, [activeTab, closeDrawer, drawerOpen, goTab, onboarding.isRunning, onboardingStep]);

  const handleAuthSuccessWithSplash = useCallback(() => {
    setSplashAnimationDone(false);
    handleAuthSuccess();
  }, [handleAuthSuccess]);

  const openFilters = () => {
    // Filters panel is not implemented yet.
  };

  const openSupplier = (s: Supplier) => {
    setOrdersOpen(false);
    setFocusOrderId(null);
    setSupplierView({ id: String(s.id), name: s.name });
  };

  const closeSupplier = () => setSupplierView(null);

  const openOrders = () => {
    setSupplierView(null);
    setOrdersOpen(true);
    setFocusOrderId(null);
    setDrawerScreen(null);
    closeDrawer();
  };

  const openOrderFromNotification = (orderId: number) => {
    setSupplierView(null);
    setDrawerScreen(null);
    setOrdersOpen(true);
    setFocusOrderId(orderId);
    closeDrawer();
  };

  const openDrawerScreen = (screen: Screen) => {
    if (screen === "search") {
      goTab("home");
      return;
    }
    if (screen === "home" || screen === "cart" || screen === "analytics" || screen === "ai" || screen === "profile") {
      goTab(screen as TabKey);
      return;
    }
    if (screen === "orders") {
      openOrders();
      return;
    }

    setOrdersOpen(false);
    setSupplierView(null);
    setDrawerScreen(screen);
    closeDrawer();
  };

  const screensLocked = !!supplierView || ordersOpen || !!drawerScreen;
  const screensClassName = `screens ${!screensLocked ? `tab-transition-${tabTransitionDir}` : ""}`.trim();

  if (!sessionBootstrapDone) {
    return <div className="app" />;
  }

  if (!authed) {
    return (
      <div className="app">
        <AuthScreen onSuccess={handleAuthSuccessWithSplash} />
      </div>
    );
  }

  if (!splashAnimationDone) {
    return (
      <div className="app">
        <div id="splash" className="splash">
          <div className="splash-logo-row">
            <img src="/media/u.svg" className="splash-letter splash-u" alt="U" />
            <img src="/media/s.svg" className="splash-letter splash-s" alt="S" />
            <img src="/media/c.svg" className="splash-letter splash-c" alt="C" />
            <img src="/media/chain.svg" className="splash-letter splash-chain" alt="Chain" />
          </div>
          <div className="splash-tagline">
            <img src="/media/desc.svg" className="splash-desc" alt="Unity supply chain" />
          </div>
        </div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="app">
        <section className="company-screen">
          <div className="company-card">
            <img src="/media/usc.svg" alt="USC" className="company-logo" />
            <div className="company-title">{"\u041e\u0448\u0438\u0431\u043a\u0430 \u043f\u0440\u043e\u0444\u0438\u043b\u044f"}</div>
            <div className="company-subtitle">{profileError}</div>
            <button className="primary-button" type="button" onClick={() => setProfileNonce((x) => x + 1)}>
              {"\u041f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u044c"}
            </button>
            <button className="auth-link" type="button" onClick={handleLogout}>
              {"\u0412\u044b\u0439\u0442\u0438"}
            </button>
          </div>
        </section>
      </div>
    );
  }

  const needsCompany = profile && companyId == null;

  return (
    <div className={`app ${drawerOpen ? "drawer-open" : ""}`}>
      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        onGo={openDrawerScreen}
        onLogout={handleLogout}
        onLogoutAll={handleLogoutAll}
        onSwitchCompany={handleOpenCompanyPicker}
        companyName={currentCompanyName}
        role={appRole}
        onRoleChange={requestRoleSwitch}
        notificationCount={notificationCount}
        completedOrders={currentCompletedOrders}
      />

      <main className={screensClassName}>
        <HomeScreen
          active={!screensLocked && activeTab === "home"}
          cartCount={cart.count}
          onBurger={openDrawer}
          onAdd={addToCart}
          showCompanyBanner={!!needsCompany}
          onPickCompany={() => openCompanyPicker(null)}
          onCategoryChange={(nextCategory) => {
            if (nextCategory !== "meat") setHomeCategoryTouched(true);
          }}
        />

        <SearchScreen
          active={!screensLocked && activeTab === "search"}
          initialCategoryId={searchPreset.categoryId}
          onOpenFilters={openFilters}
          onAdd={addToCart}
          cartCount={cart.count}
          onBurger={openDrawer}
          onOpenSupplier={openSupplier}
        />

        <AnalyticsScreen
          active={!screensLocked && activeTab === "analytics"}
          cartCount={cart.count}
          onBurger={openDrawer}
          role={appRole}
          companyId={companyId}
          showCompanyBanner={!!needsCompany}
          onPickCompany={() => openCompanyPicker(null)}
        />

        <AIChatScreen
          active={!screensLocked && activeTab === "ai"}
          cartCount={cart.count}
          onBurger={openDrawer}
          onNotify={toast.show}
          role={appRole}
          companyId={companyId}
          showCompanyBanner={!!needsCompany}
          onPickCompany={() => openCompanyPicker(null)}
          onboardingPromptEnabled={onboardingAiPromptMode}
          onOnboardingAnswerReady={setAiOnboardingAnswered}
        />

        <CartScreen
          active={!screensLocked && activeTab === "cart"}
          items={cartItems}
          total={cart.total}
          onInc={inc}
          onDec={dec}
          onRemove={cart.remove}
          onClear={cart.clear}
          cartCount={cart.count}
          onBurger={openDrawer}
          onCheckoutSuccess={openOrders}
          onCheckoutOpenChange={setCartCheckoutOpen}
          buyerCompanyId={companyId}
          onNotify={toast.show}
          onboardingDemoMode={onboardingCartDemoMode}
        />

        <ProfileScreen
          active={!screensLocked && activeTab === "profile"}
          cartCount={cart.count}
          onBurger={openDrawer}
          profile={profile}
          role={appRole}
          companyName={currentCompanyName}
          onSwitchCompany={handleOpenCompanyPicker}
          showCompanyBanner={!!needsCompany}
          onPickCompany={() => openCompanyPicker(null)}
          completedOrders={currentCompletedOrders}
        />

        <SupplierScreen
          active={!!supplierView}
          supplierId={supplierView?.id ?? null}
          supplierName={supplierView?.name ?? "\u041f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a"}
          cartCount={cart.count}
          onBack={closeSupplier}
          onAdd={addToCart}
        />

        <OrdersScreen
          active={ordersOpen}
          cartCount={cart.count}
          onBurger={openDrawer}
          onBack={() => setOrdersOpen(false)}
          buyerCompanyId={companyId}
          role={appRole}
          onOpenNotifications={() => openDrawerScreen("notifications")}
          notificationCount={notificationCount}
          focusOrderId={focusOrderId}
          onFocusOrderHandled={() => setFocusOrderId(null)}
          onNotify={toast.show}
        />

        <DeliveriesScreen
          active={drawerScreen === "deliveries"}
          onBurger={openDrawer}
          onOpenNotifications={() => openDrawerScreen("notifications")}
          notificationCount={notificationCount}
        />

        <PublicationsScreen
          active={drawerScreen === "publications"}
          onBurger={openDrawer}
          onOpenNotifications={() => openDrawerScreen("notifications")}
          notificationCount={notificationCount}
          role={appRole}
          companyId={companyId}
          showCompanyBanner={!!needsCompany}
          onPickCompany={() => openCompanyPicker(null)}
          onNotify={toast.show}
        />

        <ProfileEditScreen
          active={drawerScreen === "profile-edit"}
          onBurger={openDrawer}
          onOpenNotifications={() => openDrawerScreen("notifications")}
          notificationCount={notificationCount}
          profile={profile}
          activeCompanyId={companyId}
          onNotify={toast.show}
          onSaved={(nextProfile) => {
            setProfile(nextProfile);
            setProfileNonce((x) => x + 1);
            if (companyId) {
              const company = nextProfile.companies.find((c) => c.company_id === companyId);
              if (company) localStorage.setItem("usc_company_name", company.name || "");
            }
          }}
        />

        <NotificationsScreen
          active={drawerScreen === "notifications"}
          onBurger={openDrawer}
          onOpenNotifications={() => openDrawerScreen("notifications")}
          notificationCount={notificationCount}
          role={appRole}
          onOpenOrder={openOrderFromNotification}
          onNotify={toast.show}
          onSessionExpired={handleSessionExpired}
          onUnreadCountChange={setNotificationCount}
        />

        <AboutScreen
          active={drawerScreen === "about"}
          onBurger={openDrawer}
          onOpenNotifications={() => openDrawerScreen("notifications")}
          notificationCount={notificationCount}
          onboardingReplayRequested={onboarding.replayRequested}
          onRequestOnboardingReplay={onboarding.requestReplay}
        />

        <HelpScreen
          active={drawerScreen === "help"}
          onBurger={openDrawer}
          onOpenNotifications={() => openDrawerScreen("notifications")}
          notificationCount={notificationCount}
        />

        <FaqScreen
          active={drawerScreen === "faq"}
          onBurger={openDrawer}
          onOpenNotifications={() => openDrawerScreen("notifications")}
          notificationCount={notificationCount}
        />
      </main>

      <TabBar active={activeTab} cartCount={cart.count} onChange={goTab} />
      <OnboardingOverlay
        visible={onboarding.isRunning}
        step={onboardingStep}
        stepIndex={onboarding.stepIndex}
        totalSteps={ONBOARDING_STEPS.length}
        canGoNext={onboardingCanGoNext}
        onBack={onboarding.back}
        onNext={onboarding.next}
        onSkip={onboarding.skip}
        onFinish={onboarding.finish}
        onTargetFoundChange={setTourTargetFound}
      />
      <Toast text={toast.text} tone={toast.tone} visible={toast.visible} onClose={toast.hide} />

      {companyPickerOpen && profile ? (
        <div className="company-overlay">
          <CompanyPickerScreen
            profile={profile}
            selectedId={companyId}
            roleFilter={companyPickerRoleFilter}
            onSelect={(id) => {
              persistCompanySelection(id);
              closeCompanyPicker();
            }}
            onLogout={handleLogout}
            onClose={closeCompanyPicker}
          />
        </div>
      ) : null}
    </div>
  );
}
