import { api } from "./client";

export type Delivery = {
  id: number;
  order_id: number;
  order_comment?: string | null;
  courier_id?: number | null;
  status?: string | null;
  tracking_link?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

export async function fetchDeliveries() {
  return api<Delivery[]>(`/deliveries/`, { auth: true });
}

export async function fetchDeliveryByOrder(orderId: number) {
  return api<Delivery | null>(`/deliveries/by_order/${orderId}/`, { auth: true });
}

export async function setDeliveryStatus(deliveryId: number, status: string) {
  return api<Delivery>(`/deliveries/${deliveryId}/set_status/`, {
    method: "POST",
    body: { status },
    auth: true,
  });
}
