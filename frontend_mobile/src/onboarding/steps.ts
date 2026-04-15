import type { AppRole } from "@usc/core";
import type { MobileOnboardingStep } from "@/onboarding/types";

export function getOnboardingSteps(role: AppRole): MobileOnboardingStep[] {
  if (role === "supplier") {
    return [
      {
        id: "welcome",
        title: "Welcome to USC mobile",
        description: "This guide walks through the supplier workspace: SKUs, deliveries, orders, analytics, AI, and profile context.",
        route: "/home",
        accent: "brand",
      },
      {
        id: "publications",
        title: "Manage supplier publications",
        description: "Create and update SKU cards for the active supplier company from the Publications tab.",
        route: "/publications",
        accent: "action",
      },
      {
        id: "deliveries",
        title: "Control deliveries",
        description: "Deliveries lets supplier managers assign couriers, edit tracking links and move shipment status forward.",
        route: "/deliveries",
        accent: "action",
      },
      {
        id: "orders",
        title: "Work the inbox and outbox",
        description: "Supplier order mode shows inbox and outbox so you can confirm demand and keep the pipeline moving.",
        route: "/orders",
        accent: "insight",
      },
      {
        id: "analytics",
        title: "Review supplier metrics",
        description: "Analytics summarizes revenue, actions, category mix and the current company share on the platform.",
        route: "/analytics",
        accent: "insight",
      },
      {
        id: "ai",
        title: "Ask AI and run scenarios",
        description: "AI workspace keeps chat sessions and a compact what-if simulator tied to the active company context.",
        route: "/ai",
        accent: "success",
      },
      {
        id: "profile",
        title: "Keep company context visible",
        description: "Profile is where you switch companies, edit company details, and open help/about/FAQ screens.",
        route: "/profile",
        accent: "success",
      },
    ];
  }

  return [
    {
      id: "welcome",
      title: "Welcome to USC mobile",
      description: "This guide walks through the buyer route: catalog, cart, analytics, AI, and profile context.",
      route: "/home",
      accent: "brand",
    },
    {
      id: "home",
      title: "Search the buyer catalog",
      description: "Home lets you search products and suppliers, switch categories, and inspect product details from mobile.",
      route: "/home",
      accent: "action",
    },
    {
      id: "cart",
      title: "Checkout with delivery details",
      description: "Cart handles buyer company validation, single-supplier checkout, delivery coordinates and order creation.",
      route: "/cart",
      accent: "action",
    },
    {
      id: "orders",
      title: "Track buyer orders",
      description: "Orders shows the buyer history for the active company and opens into a full order detail view.",
      route: "/orders",
      accent: "insight",
    },
    {
      id: "analytics",
      title: "Review buyer metrics",
      description: "Analytics summarizes buyer KPIs, top products, categories and the current action queue.",
      route: "/analytics",
      accent: "insight",
    },
    {
      id: "ai",
      title: "Ask AI and run scenarios",
      description: "AI workspace keeps analytics chat sessions and compact what-if scenarios for the active buyer company.",
      route: "/ai",
      accent: "success",
    },
    {
      id: "profile",
      title: "Manage company context",
      description: "Profile is where you switch companies, edit account data, and open help/about/FAQ screens.",
      route: "/profile",
      accent: "success",
    },
  ];
}
