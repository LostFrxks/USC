import type { OnboardingStep } from "./types";

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    title: "Добро пожаловать в USC",
    description: "Это короткий проводник по ключевым возможностям. Можно пропустить в любой момент.",
    mode: "info",
    screen: "home",
  },
  {
    id: "open_drawer",
    title: "Откройте меню",
    description: "Нажмите кнопку меню в левом верхнем углу. Там собраны разделы и быстрые действия.",
    mode: "interaction_required",
    screen: "home",
    targetSelector: '[data-tour-id="top-burger"]',
    actionHint: "Нажмите на кнопку меню, чтобы продолжить.",
  },
  {
    id: "home_products",
    title: "Витрина товаров",
    description: "Здесь вы смотрите карточки товаров, фильтруете категории и быстро добавляете позиции в корзину.",
    mode: "info",
    screen: "home",
    targetSelector: '[data-tour-id="home-product-grid"]',
  },
  {
    id: "cart_checkout",
    title: "Оформление заказа",
    description: "Перейдите в корзину и откройте оформление. Здесь задается адрес, карта и комментарий к заказу.",
    mode: "interaction_required",
    screen: "cart",
    targetSelector: '[data-tour-id="cart-open-checkout"]',
    actionHint: "Откройте оформление заказа, чтобы продолжить.",
  },
  {
    id: "analytics_overview",
    title: "Ключевая аналитика",
    description: "В этом блоке выручка, delivery и отмены. Это главные метрики для быстрых решений.",
    mode: "info",
    screen: "analytics",
    targetSelector: '[data-tour-id="analytics-kpi-overview"]',
  },
  {
    id: "ai_assistant",
    title: "AI-ассистент",
    description: "Задавайте вопросы по данным компании. Ниже — What-if Studio для сценарных экспериментов.",
    mode: "info",
    screen: "ai",
    targetSelector: '[data-tour-id="ai-input-row"]',
  },
  {
    id: "profile_company",
    title: "Профиль и компания",
    description: "Здесь можно переключать активную компанию и управлять своим рабочим контекстом.",
    mode: "info",
    screen: "profile",
    targetSelector: '[data-tour-id="profile-switch-company"]',
  },
  {
    id: "finish",
    title: "Гид завершен",
    description: "Повторно запустить его можно в О приложении -> Advanced.",
    mode: "info",
    screen: "profile",
  },
];

