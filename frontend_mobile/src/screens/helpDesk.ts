import type { AppRole } from "@usc/core";

export type HelpQuickAction = {
  id: string;
  label: string;
  description: string;
  route?: string;
  aiPrompt?: string;
};

export function buildHelpQuickActions(role: AppRole): HelpQuickAction[] {
  if (role === "supplier") {
    return [
      {
        id: "orders",
        label: "Open supplier orders",
        description: "Review inbox or outbox to spot blocked supplier orders.",
        route: "/(app)/(tabs)/orders",
      },
      {
        id: "deliveries",
        label: "Open deliveries",
        description: "Check courier assignment, tracking link, or delivery status.",
        route: "/(app)/(tabs)/deliveries",
      },
      {
        id: "publications",
        label: "Review SKUs",
        description: "Inspect supplier publications for stock or price issues.",
        route: "/(app)/(tabs)/publications",
      },
      {
        id: "ai",
        label: "Run AI diagnostic",
        description: "Send a supplier support prompt into the AI workspace.",
        route: "/(app)/ai",
        aiPrompt: "Summarize our supplier-side operational risks and tell me the top actions to stabilize orders, deliveries, and SKU performance.",
      },
    ];
  }

  return [
    {
      id: "orders",
      label: "Open buyer orders",
      description: "Review recent orders and current delivery state.",
      route: "/(app)/(tabs)/orders",
    },
    {
      id: "cart",
      label: "Open cart",
      description: "Check checkout data, address, and delivery coordinates.",
      route: "/(app)/(tabs)/cart",
    },
    {
      id: "analytics",
      label: "Open analytics",
      description: "Inspect recent trends before escalating the issue.",
      route: "/(app)/analytics",
    },
    {
      id: "ai",
      label: "Run AI diagnostic",
      description: "Send a buyer support prompt into the AI workspace.",
      route: "/(app)/ai",
      aiPrompt: "Summarize our buyer-side operational risks and tell me the top actions to stabilize orders, deliveries, and supplier performance.",
    },
  ];
}

export function replyToHelpQuestion(role: AppRole, question: string): string {
  const q = question.trim().toLowerCase();
  if (!q) {
    return "Write the issue in one sentence and USC will route you to the best next action.";
  }
  if (q.includes("delivery") || q.includes("courier") || q.includes("tracking")) {
    return role === "supplier"
      ? "This looks like a delivery workflow issue. Open Deliveries, verify courier assignment, then confirm tracking link and current status."
      : "This looks like a buyer delivery issue. Open Orders, inspect the order detail, and verify the delivery state and geo point.";
  }
  if (q.includes("order") || q.includes("cancel") || q.includes("confirm")) {
    return role === "supplier"
      ? "This looks like an order-pipeline issue. Start with supplier inbox/outbox, then confirm whether stock, status, or delivery blocked the order."
      : "This looks like a buyer order issue. Start with your order history, then check delivery status and whether the cart needs to be rebuilt.";
  }
  if (q.includes("stock") || q.includes("sku") || q.includes("price") || q.includes("publication")) {
    return "This looks like a catalog/publication issue. Open the SKU workspace and verify price, stock quantity, and inventory tracking flags.";
  }
  if (q.includes("analytics") || q.includes("ai") || q.includes("trend")) {
    return "This looks like an analytics question. Open Analytics first, then use AI workspace for a focused diagnostic prompt.";
  }
  return role === "supplier"
    ? "Start with Orders or Deliveries depending on whether the issue is pipeline-related or fulfilment-related. If the pattern is unclear, run the supplier AI diagnostic."
    : "Start with Orders or Cart depending on whether the issue is historical or checkout-related. If the pattern is unclear, run the buyer AI diagnostic.";
}
