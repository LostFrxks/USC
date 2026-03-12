import { api } from "./client";

/**
 * buyer_company_id приходит из выбранной компании пользователя.
 */

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
  tracking_link?: string | null;
  notes?: string | null;
};

export type Order = {
  id: number;
  status: string;
  createdAt?: string | null;
  deliveryAddress?: string | null;
  comment?: string | null;
  buyerCompanyId?: number | null;
  supplierCompanyId?: number | null;
  itemsCount?: number | null;
  total?: number | null;
  items?: OrderItem[] | null;
  delivery?: DeliveryInfo | null;
};

type ApiOrderItem = {
  product_id: number;
  qty: number;
  price_snapshot?: number | null;
  name?: string | null;
};

type ApiOrder = {
  id: number;
  status: string;
  created_at?: string | null;
  delivery_address?: string | null;
  comment?: string | null;
  buyer_company_id?: number;
  supplier_company_id?: number;
  items?: ApiOrderItem[];
  delivery?: {
    id: number;
    courier?: number | null;
    status?: string | null;
    tracking_link?: string | null;
    notes?: string | null;
  } | null;
};

type OrderListRowApi = {
  id: number;
  status: string;
  created_at: string | null;
  delivery_address: string | null;
  comment: string | null;
  items_count: number | null;
  total: number | null;
};

type OrderDetailApi = {
  id: number;
  status: string;
  created_at: string | null;
  delivery_address: string | null;
  comment: string | null;
  buyer_company_id: number;
  supplier_company_id: number;
  items: Array<{
    product_id: number;
    qty: number;
    price_snapshot: number | null;
    name: string | null;
  }>;
};

export type CreateOrderPayload = {
  address?: string;
  delivery_address?: string;
  comment?: string;
  buyer_company_id: number;
  supplier_company_id: number;
  items: Array<{ product_id: number; qty: number }>;
  delivery_mode?: "delivery" | "pickup" | "YANDEX" | "SUPPLIER_COURIER" | "BUYER_COURIER";
  status?: string;
};

type CreateOrderResponse = { id: number; status: string };

const ORDERS = "/orders/";
const CREATE = "/orders/create/";
const INBOX = "/orders/inbox/";
const OUTBOX = "/orders/outbox/";

function normalizeStatus(raw: string): string {
  const up = (raw || "").toUpperCase();
  switch (up) {
    case "PENDING":
    case "CREATED":
      return "created";
    case "CONFIRMED":
      return "confirmed";
    case "DELIVERING":
      return "delivering";
    case "DELIVERED":
      return "delivered";
    case "PARTIALLY_DELIVERED":
      return "partially_delivered";
    case "CANCELLED":
    case "CANCELED":
      return "cancelled";
    case "FAILED":
      return "failed";
    default:
      return raw?.toLowerCase?.() ?? raw;
  }
}

function normalizeListRow(x: OrderListRowApi): Order {
  return {
    id: x.id,
    status: normalizeStatus(x.status),
    createdAt: x.created_at,
    deliveryAddress: x.delivery_address,
    comment: x.comment,
    buyerCompanyId: null,
    supplierCompanyId: null,
    itemsCount: x.items_count,
    total: x.total,
    items: null,
  };
}

function normalizeDetail(x: OrderDetailApi): Order {
  return {
    id: x.id,
    status: normalizeStatus(x.status),
    createdAt: x.created_at,
    deliveryAddress: x.delivery_address,
    comment: x.comment,
    buyerCompanyId: x.buyer_company_id,
    supplierCompanyId: x.supplier_company_id,
    itemsCount: x.items?.length ?? 0,
    total: null,
    items: (x.items ?? []).map((it) => ({
      productId: it.product_id,
      qty: it.qty,
      priceSnapshot: it.price_snapshot,
      name: it.name,
    })),
  };
}

function normalizeFullOrder(x: ApiOrder): Order {
  const items = (x.items ?? []).map((it) => ({
    productId: it.product_id,
    qty: it.qty,
    priceSnapshot: it.price_snapshot ?? null,
    name: it.name ?? null,
  }));

  const total = items.reduce((acc, it) => {
    if (typeof it.priceSnapshot === "number") return acc + it.priceSnapshot * it.qty;
    return acc;
  }, 0);

  return {
    id: x.id,
    status: normalizeStatus(x.status),
    createdAt: x.created_at ?? null,
    deliveryAddress: x.delivery_address ?? null,
    comment: x.comment ?? null,
    buyerCompanyId: x.buyer_company_id ?? null,
    supplierCompanyId: x.supplier_company_id ?? null,
    itemsCount: items.length,
    total: total > 0 ? total : null,
    items,
    delivery: x.delivery ?? null,
  };
}

export async function fetchOrders(params?: {
  buyerCompanyId?: number | null;
  limit?: number;
  offset?: number;
}): Promise<Order[]> {
  const buyerCompanyId = params?.buyerCompanyId ?? null;
  const limit = params?.limit ?? 50;
  const offset = params?.offset ?? 0;

  if (!buyerCompanyId) return [];

  const qs = new URLSearchParams();
  qs.set("buyer_company_id", String(buyerCompanyId));
  qs.set("limit", String(limit));
  qs.set("offset", String(offset));

  const data = await api<OrderListRowApi[]>(`${ORDERS}?${qs.toString()}`, { auth: true });
  return (data ?? []).map(normalizeListRow);
}

export async function fetchOrderDetail(
  orderId: number,
  buyerCompanyId?: number
): Promise<Order | null> {
  if (!buyerCompanyId) return null;
  const qs = new URLSearchParams();
  qs.set("buyer_company_id", String(buyerCompanyId));

  try {
    const data = await api<OrderDetailApi>(`${ORDERS}${orderId}/?${qs.toString()}`, { auth: true });
    return normalizeDetail(data);
  } catch {
    return null;
  }
}

export async function fetchOrdersInbox(): Promise<Order[]> {
  const data = await api<ApiOrder[]>(INBOX, { auth: true });
  return (data ?? []).map(normalizeFullOrder);
}

export async function fetchOrdersOutbox(): Promise<Order[]> {
  const data = await api<ApiOrder[]>(OUTBOX, { auth: true });
  return (data ?? []).map(normalizeFullOrder);
}

export async function createOrder(payload: CreateOrderPayload): Promise<CreateOrderResponse> {
  const idempotencyKey =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return api<CreateOrderResponse>(CREATE, {
    method: "POST",
    body: payload,
    auth: true,
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export async function supplierConfirmOrder(orderId: number): Promise<Order> {
  const data = await api<ApiOrder>(`${ORDERS}${orderId}/supplier_confirm/`, {
    method: "POST",
    auth: true,
  });
  return normalizeFullOrder(data);
}

export async function cancelOrder(orderId: number): Promise<Order> {
  const data = await api<ApiOrder>(`${ORDERS}${orderId}/cancel/`, {
    method: "POST",
    auth: true,
  });
  return normalizeFullOrder(data);
}
