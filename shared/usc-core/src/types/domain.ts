export type AppRole = "buyer" | "supplier";

export type CompanyMembership = {
  companyId: number;
  name: string;
  companyType?: string | null;
  phone?: string | null;
  address?: string | null;
  role?: string | null;
};

export type SessionProfile = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  role?: string | null;
  isCourierEnabled?: boolean;
  companies: CompanyMembership[];
};

export type CategoryDto = {
  id: number;
  name: string;
};

export type SupplierSummary = {
  id: string;
  name: string;
  subtitle: string;
  logo?: string | null;
};

export type CatalogImageKey = "meat" | "milk" | "fish" | "bread" | "fruit" | "grain" | "default";

export type CatalogProduct = {
  id: string;
  name: string;
  seller: string;
  description?: string;
  shelfLifeDays?: number | null;
  storageCondition?: string | null;
  originCountry?: string | null;
  brand?: string | null;
  manufacturer?: string | null;
  packageType?: string | null;
  netWeightGrams?: number | null;
  allergens?: string | null;
  certifications?: string | null;
  leadTimeDays?: number | null;
  price: number;
  rating: string;
  reviews: number;
  categoryKey: CatalogImageKey;
  supplierCompanyId?: number;
  categoryId?: number | null;
};

export type SupplierProduct = {
  id: number;
  supplierCompanyId: number | null;
  categoryId: number | null;
  name: string;
  description: string;
  shelfLifeDays: number | null;
  storageCondition: string | null;
  originCountry: string | null;
  brand: string | null;
  manufacturer: string | null;
  packageType: string | null;
  netWeightGrams: number | null;
  allergens: string | null;
  certifications: string | null;
  leadTimeDays: number | null;
  price: number;
  unit: string;
  minQty: number;
  inStock: boolean;
  trackInventory: boolean;
  stockQty: number | null;
  supplierName: string | null;
  categoryName: string | null;
  createdAt: string | null;
};

export type OrderStatus =
  | "created"
  | "confirmed"
  | "delivering"
  | "delivered"
  | "partially_delivered"
  | "cancelled"
  | "failed";

export type DeliveryStatus = "assigned" | "picked_up" | "on_the_way" | "delivered" | "failed" | "cancelled" | "unknown";

export type OrderItem = {
  productId: number;
  qty: number;
  priceSnapshot?: number | null;
  name?: string | null;
};

export type DeliveryInfo = {
  id: number;
  courier?: number | null;
  status?: string | null;
  trackingLink?: string | null;
  notes?: string | null;
};

export type OrderSummary = {
  id: number;
  status: OrderStatus;
  createdAt?: string | null;
  deliveryAddress?: string | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  comment?: string | null;
  buyerCompanyId?: number | null;
  supplierCompanyId?: number | null;
  itemsCount?: number | null;
  total?: number | null;
  items?: OrderItem[] | null;
  delivery?: DeliveryInfo | null;
};

export type OrderDetail = OrderSummary;

export type DeliveryRecord = {
  id: number;
  orderId: number;
  orderComment?: string | null;
  courierId?: number | null;
  status?: string | null;
  trackingLink?: string | null;
  notes?: string | null;
  createdAt?: string | null;
};

export type AssignableCourier = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  companyIds: number[];
};

export type NotificationItem = {
  id: number;
  domain: string;
  eventType: string;
  resourceType: string;
  resourceId: string;
  title: string;
  text: string;
  payload?: Record<string, unknown>;
  createdAt?: string | null;
  isRead: boolean;
  readAt?: string | null;
};

export type NotificationList = {
  items: NotificationItem[];
  unreadCount: number;
};

export type AnalyticsAlert = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  metricKey: string;
  metricValue: number | string;
  threshold?: number | string;
  actionHint: string;
};

export type AnalyticsAction = {
  id: string;
  priority: number;
  title: string;
  rationale: string;
  expectedImpactAbs?: number;
  expectedImpactPct?: number;
  confidence: number;
  owner: AppRole;
};

export type BuyerSavingsWatchlistItem = {
  anchorProductId: number;
  anchorProductName: string;
  currentSupplierName: string;
  currentPrice: number;
  altSupplierName: string;
  altProductName: string;
  altPrice: number;
  savingsAbs: number;
  savingsPct: number;
};

export type BuyerSupplierReliabilityItem = {
  supplierCompanyId: number;
  supplierName: string;
  score: number;
  deliveryRatePct: number;
  cancelRatePct: number;
  repeatSharePct: number;
  deliveredOrders: number;
};

export type BuyerConcentration = {
  supplierHhi: number;
  categoryHhi: number;
  riskLevel: "low" | "medium" | "high";
};

export type SupplierPriceCompetitiveness = {
  skuCompared: number;
  overpricedSharePct: number;
  underpricedSharePct: number;
  medianGapPct: number;
  topOverpricedSkus: Array<{ productId: number; name: string; gapPct: number }>;
};

export type SupplierBuyerRetention = {
  newBuyers: number;
  returningBuyers: number;
  atRiskBuyers: number;
  repeatRatePct: number;
};

export type SupplierRevenueLeakage = {
  cancelledOrders: number;
  cancelledValueEstimate: number;
  pipelineOrders: number;
  pipelineValueEstimate: number;
  leakageScore: number;
};

export type AnalyticsModules = {
  generatedAt: string;
  alerts: AnalyticsAlert[];
  actions: AnalyticsAction[];
  buyer?: {
    savingsWatchlist: BuyerSavingsWatchlistItem[];
    supplierReliability: BuyerSupplierReliabilityItem[];
    concentration: BuyerConcentration;
  };
  supplier?: {
    priceCompetitiveness: SupplierPriceCompetitiveness;
    buyerRetention: SupplierBuyerRetention;
    revenueLeakage: SupplierRevenueLeakage;
  };
};

export type BuyerRecommendationAlternative = {
  anchorProductId: number;
  anchorProductName: string;
  anchorSupplierCompanyId: number;
  anchorSupplierName: string;
  anchorPrice: number;
  candidateProductId: number;
  candidateProductName: string;
  candidateSupplierCompanyId: number;
  candidateSupplierName: string;
  candidatePrice: number;
  unit: string;
  savingsAbs: number;
  savingsPct: number;
  rationale: string;
};

export type BuyerRecommendations = {
  cheaperAlternatives: BuyerRecommendationAlternative[];
  reliableSuppliers: BuyerSupplierReliabilityItem[];
  generatedAt: string;
};

export type AnalyticsSummary = {
  companyId: number;
  role: AppRole;
  days: number;
  totalOrders: number;
  totalRevenue: number;
  dailyRevenue: Array<{ day: string; revenue: number }>;
  topProducts: Array<{ productId: number; name: string; revenue: number; qtyTotal: number }>;
  market: {
    platformRevenue: number;
    platformOrders: number;
    companySharePct: number;
  };
  marketTrends: Array<{ month: string; revenue: number }>;
  salesTrends: Array<{ month: string; revenue: number }>;
  categoryBreakdown: Array<{ name: string; revenue: number; sharePct: number }>;
  statusFunnel: Array<{ status: string; count: number }>;
  insights: string[];
  analyticsModules?: AnalyticsModules;
  buyerRecommendations?: BuyerRecommendations;
};

export type AnalyticsAssistantResponse = {
  summary: string;
  probableCauses: string[];
  actions: string[];
  confidence: number;
  focusMonth: string | null;
  chatSessionId?: number;
  showMetrics?: boolean;
  metrics: {
    momPct: number | null;
    deliveryRatePct: number;
    cancelRatePct: number;
    marketSharePct: number;
    topCategoryName: string;
    topCategorySharePct: number;
  };
};

export type AiChatMessage = {
  id: number;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  payload?: AnalyticsAssistantResponse | null;
};

export type AiChatSession = {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
  messageCount: number;
  preview: string;
  messages: AiChatMessage[];
};

export type WhatIfLevers = {
  deliveryImprovePp?: number;
  cancelReducePp?: number;
  topCategoryShareReducePp?: number;
  promoIntensityPct?: number;
  cheaperSupplierShiftPct?: number;
  reliableSupplierShiftPct?: number;
  priceCutOverpricedPct?: number;
  pipelineRecoveryPct?: number;
};

export type WhatIfMetrics = {
  horizonDays: number;
  periods: number;
  monthlyBaseSom: number;
  revenueForecastSom: number;
  momPct: number | null;
  deliveryRatePct: number;
  cancelRatePct: number;
  marketSharePct: number;
  topCategoryName: string;
  topCategorySharePct: number;
  supplierHhi: number;
  categoryHhi: number;
  savingsPotentialSom: number;
  avgWatchSavingsPct: number;
  leakageScore: number;
  leakageValueSom: number;
  repeatRatePct: number;
};

export type WhatIfResponse = {
  role: AppRole;
  horizonDays: 30 | 60 | 90;
  selectedMonth: string | null;
  levers: Required<WhatIfLevers>;
  baseline: WhatIfMetrics;
  scenario: WhatIfMetrics;
  delta: Record<string, number | null>;
  compareSeries: Array<{ period: string; baseline: number; scenario: number }>;
  drilldown: {
    by: "category" | "sku";
    points: Array<{ key: string; baseline: number; scenario: number; deltaPct: number }>;
  };
  drivers: string[];
  warnings: string[];
  confidence: number;
};

export type WhatIfScenario = {
  id: number;
  title: string;
  role: AppRole;
  horizonDays: number;
  selectedMonth: string | null;
  levers: Required<WhatIfLevers>;
  result: WhatIfResponse | null;
  createdAt: string;
  updatedAt: string;
};

export type CartLine = {
  product: CatalogProduct;
  qty: number;
};
