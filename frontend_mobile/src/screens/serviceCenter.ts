import type { AppRole } from "@usc/core";

export type ServiceFaqCategory = "all" | "orders" | "payments" | "suppliers" | "analytics";

export type ServiceFaqItem = {
  id: string;
  category: Exclude<ServiceFaqCategory, "all">;
  question: string;
  answer: string;
  route?: string;
};

export const SERVICE_FAQ: ServiceFaqItem[] = [
  {
    id: "payments",
    category: "payments",
    question: "How does payment work in USC?",
    answer: "Orders are fixed in the system, then the buyer pays through USC-compatible flows. Supplier payout should happen only after the delivery state is confirmed.",
    route: "/(app)/(tabs)/orders",
  },
  {
    id: "publish",
    category: "suppliers",
    question: "Who can publish goods in USC?",
    answer: "Farmers, wholesalers, producers, and supplier-side companies that passed the USC onboarding and verification flow.",
    route: "/(app)/(tabs)/publications",
  },
  {
    id: "single-supplier",
    category: "orders",
    question: "Can I work with only one supplier?",
    answer: "Yes. But the product value of USC is that you can compare multiple suppliers, prices, and delivery options in one place.",
    route: "/(app)/(tabs)/cart",
  },
  {
    id: "mobile-app",
    category: "analytics",
    question: "Do buyers need a separate app?",
    answer: "This mobile client is exactly that buyer-first app, and it is gradually moving toward supplier and analytics parity as well.",
    route: "/(app)/analytics",
  },
];

export function filterServiceFaq(items: ServiceFaqItem[], query: string, category: ServiceFaqCategory): ServiceFaqItem[] {
  const normalized = query.trim().toLowerCase();
  return items.filter((item) => {
    if (category !== "all" && item.category !== category) return false;
    if (!normalized) return true;
    return item.question.toLowerCase().includes(normalized) || item.answer.toLowerCase().includes(normalized);
  });
}

export function buildServiceAiPrompt(role: AppRole, item: ServiceFaqItem): string {
  if (role === "supplier") {
    return `Explain the supplier-side workflow for this USC support topic and tell me the next action: ${item.question}`;
  }
  return `Explain the buyer-side workflow for this USC support topic and tell me the next action: ${item.question}`;
}
