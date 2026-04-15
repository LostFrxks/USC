import type { AssignableCourier, DeliveryRecord } from "../types/domain";
import type { Transport } from "../transport/contracts";

type DeliveryApi = {
  list(): Promise<DeliveryRecord[]>;
  byOrder(orderId: number): Promise<DeliveryRecord | null>;
  setStatus(deliveryId: number, status: string): Promise<DeliveryRecord>;
  upsertForOrder(payload: {
    orderId: number;
    courierId?: number | null;
    trackingLink?: string;
    notes?: string;
  }): Promise<DeliveryRecord>;
  listAssignableCouriers(orderId: number): Promise<AssignableCourier[]>;
};

type DeliveryWire = {
  id: number;
  order_id: number;
  order_comment?: string | null;
  courier_id?: number | null;
  status?: string | null;
  tracking_link?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

function normalizeDelivery(delivery: DeliveryWire): DeliveryRecord {
  return {
    id: delivery.id,
    orderId: delivery.order_id,
    orderComment: delivery.order_comment ?? null,
    courierId: delivery.courier_id ?? null,
    status: delivery.status ?? null,
    trackingLink: delivery.tracking_link ?? null,
    notes: delivery.notes ?? null,
    createdAt: delivery.created_at ?? null,
  };
}

export function createDeliveriesApi(transport: Transport): DeliveryApi {
  return {
    async list() {
      const data = await transport.request<DeliveryWire[]>("/deliveries/", { auth: true });
      return (data ?? []).map(normalizeDelivery);
    },

    async byOrder(orderId) {
      const data = await transport.request<DeliveryWire | null>(`/deliveries/by_order/${orderId}/`, { auth: true });
      return data ? normalizeDelivery(data) : null;
    },

    async setStatus(deliveryId, status) {
      const data = await transport.request<DeliveryWire>(`/deliveries/${deliveryId}/set_status/`, {
        method: "POST",
        auth: true,
        body: { status },
      });
      return normalizeDelivery(data);
    },

    async upsertForOrder(payload) {
      const data = await transport.request<DeliveryWire>("/deliveries/upsert_for_order/", {
        method: "POST",
        auth: true,
        body: {
          order: payload.orderId,
          courier: payload.courierId ?? null,
          tracking_link: payload.trackingLink ?? "",
          notes: payload.notes ?? "",
        },
      });
      return normalizeDelivery(data);
    },

    async listAssignableCouriers(orderId) {
      const data = await transport.request<Array<{
        id: number;
        email: string;
        first_name: string;
        last_name: string;
        phone?: string | null;
        company_ids?: number[];
      }>>(`/deliveries/couriers/by_order/${orderId}/`, { auth: true });

      return (data ?? []).map((courier) => ({
        id: courier.id,
        email: courier.email,
        firstName: courier.first_name ?? "",
        lastName: courier.last_name ?? "",
        phone: courier.phone ?? null,
        companyIds: courier.company_ids ?? [],
      }));
    },
  };
}
