import type { DeliveryInfo, OrderDetail, OrderSummary } from "../types/domain";
import type { Transport } from "../transport/contracts";
import { createIdempotencyKey } from "../utils/idempotency";
import { normalizeOrderStatus } from "../utils/status";

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
  delivery_lat?: number | null;
  delivery_lng?: number | null;
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
  delivery_lat?: number | null;
  delivery_lng?: number | null;
  comment: string | null;
  items_count: number | null;
  total: number | null;
};

type OrderDetailApi = {
  id: number;
  status: string;
  created_at: string | null;
  delivery_address: string | null;
  delivery_lat?: number | null;
  delivery_lng?: number | null;
  comment: string | null;
  buyer_company_id: number;
  supplier_company_id: number;
  items: ApiOrderItem[];
};

function normalizeDeliveryInfo(delivery: ApiOrder["delivery"]): DeliveryInfo | null {
  if (!delivery) return null;
  return {
    id: delivery.id,
    courier: delivery.courier,
    status: delivery.status,
    trackingLink: delivery.tracking_link,
    notes: delivery.notes,
  };
}

function normalizeListRow(order: OrderListRowApi): OrderSummary {
  return {
    id: order.id,
    status: normalizeOrderStatus(order.status),
    createdAt: order.created_at,
    deliveryAddress: order.delivery_address,
    deliveryLat: order.delivery_lat ?? null,
    deliveryLng: order.delivery_lng ?? null,
    comment: order.comment,
    buyerCompanyId: null,
    supplierCompanyId: null,
    itemsCount: order.items_count,
    total: order.total,
    items: null,
  };
}

function normalizeDetail(order: OrderDetailApi): OrderDetail {
  return {
    id: order.id,
    status: normalizeOrderStatus(order.status),
    createdAt: order.created_at,
    deliveryAddress: order.delivery_address,
    deliveryLat: order.delivery_lat ?? null,
    deliveryLng: order.delivery_lng ?? null,
    comment: order.comment,
    buyerCompanyId: order.buyer_company_id,
    supplierCompanyId: order.supplier_company_id,
    itemsCount: order.items?.length ?? 0,
    total: null,
    items: (order.items ?? []).map((item) => ({
      productId: item.product_id,
      qty: item.qty,
      priceSnapshot: item.price_snapshot,
      name: item.name,
    })),
  };
}

function normalizeFullOrder(order: ApiOrder): OrderSummary {
  const items = (order.items ?? []).map((item) => ({
    productId: item.product_id,
    qty: item.qty,
    priceSnapshot: item.price_snapshot ?? null,
    name: item.name ?? null,
  }));
  const total = items.reduce((sum, item) => (typeof item.priceSnapshot === "number" ? sum + item.priceSnapshot * item.qty : sum), 0);
  return {
    id: order.id,
    status: normalizeOrderStatus(order.status),
    createdAt: order.created_at ?? null,
    deliveryAddress: order.delivery_address ?? null,
    deliveryLat: order.delivery_lat ?? null,
    deliveryLng: order.delivery_lng ?? null,
    comment: order.comment ?? null,
    buyerCompanyId: order.buyer_company_id ?? null,
    supplierCompanyId: order.supplier_company_id ?? null,
    itemsCount: items.length,
    total: total > 0 ? total : null,
    items,
    delivery: normalizeDeliveryInfo(order.delivery),
  };
}

type OrdersApi = {
  listBuyerOrders(params: { buyerCompanyId: number; limit?: number; offset?: number }): Promise<OrderSummary[]>;
  listInbox(): Promise<OrderSummary[]>;
  listOutbox(): Promise<OrderSummary[]>;
  fetchDetail(orderId: number, buyerCompanyId?: number): Promise<OrderDetail | null>;
  create(payload: {
    address?: string;
    deliveryAddress?: string;
    deliveryLat?: number | null;
    deliveryLng?: number | null;
    comment?: string;
    buyerCompanyId: number;
    supplierCompanyId: number;
    items: Array<{ productId: number; qty: number }>;
    deliveryMode?: "YANDEX" | "SUPPLIER_COURIER" | "BUYER_COURIER";
    status?: string;
  }): Promise<{ id: number; status: string }>;
  supplierConfirm(orderId: number): Promise<OrderSummary>;
  cancel(orderId: number): Promise<OrderSummary>;
};

export function createOrdersApi(transport: Transport): OrdersApi {
  return {
    async listBuyerOrders(params) {
      const qs = new URLSearchParams();
      qs.set("buyer_company_id", String(params.buyerCompanyId));
      qs.set("limit", String(params.limit ?? 50));
      qs.set("offset", String(params.offset ?? 0));
      const data = await transport.request<OrderListRowApi[]>(`/orders/?${qs.toString()}`, { auth: true });
      return (data ?? []).map(normalizeListRow);
    },

    async listInbox() {
      const data = await transport.request<ApiOrder[]>("/orders/inbox/", { auth: true });
      return (data ?? []).map(normalizeFullOrder);
    },

    async listOutbox() {
      const data = await transport.request<ApiOrder[]>("/orders/outbox/", { auth: true });
      return (data ?? []).map(normalizeFullOrder);
    },

    async fetchDetail(orderId, buyerCompanyId) {
      const qs = new URLSearchParams();
      if (buyerCompanyId) qs.set("buyer_company_id", String(buyerCompanyId));
      const url = qs.toString() ? `/orders/${orderId}/?${qs.toString()}` : `/orders/${orderId}/`;
      try {
        const data = await transport.request<OrderDetailApi>(url, { auth: true });
        return normalizeDetail(data);
      } catch {
        return null;
      }
    },

    create(payload) {
      return transport.request<{ id: number; status: string }>("/orders/create/", {
        method: "POST",
        auth: true,
        headers: {
          "Idempotency-Key": createIdempotencyKey(),
        },
        body: {
          address: payload.address,
          delivery_address: payload.deliveryAddress,
          delivery_lat: payload.deliveryLat,
          delivery_lng: payload.deliveryLng,
          comment: payload.comment,
          buyer_company_id: payload.buyerCompanyId,
          supplier_company_id: payload.supplierCompanyId,
          items: payload.items.map((item) => ({
            product_id: item.productId,
            qty: item.qty,
          })),
          delivery_mode: payload.deliveryMode,
          status: payload.status,
        },
      });
    },

    async supplierConfirm(orderId) {
      const data = await transport.request<ApiOrder>(`/orders/${orderId}/supplier_confirm/`, {
        method: "POST",
        auth: true,
      });
      return normalizeFullOrder(data);
    },

    async cancel(orderId) {
      const data = await transport.request<ApiOrder>(`/orders/${orderId}/cancel/`, {
        method: "POST",
        auth: true,
      });
      return normalizeFullOrder(data);
    },
  };
}
