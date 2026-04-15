import { isActiveOrderStatus, type DeliveryRecord, type OrderSummary, type SupplierProduct } from "@usc/core";

export type WorkspaceStat = {
  id: string;
  label: string;
  value: string;
};

export function buildBuyerWorkspaceStats(params: {
  cartLines: number;
  orders: OrderSummary[];
  suppliers: number;
  products: number;
}): WorkspaceStat[] {
  const activeOrders = params.orders.filter((order) => isActiveOrderStatus(order.status)).length;
  const deliveredOrders = params.orders.filter((order) => order.status === "delivered").length;
  return [
    { id: "cart", label: "Cart lines", value: String(params.cartLines) },
    { id: "active", label: "Active orders", value: String(activeOrders) },
    { id: "delivered", label: "Delivered", value: String(deliveredOrders) },
    { id: "suppliers", label: "Suppliers", value: String(params.suppliers || params.products) },
  ];
}

export function buildSupplierWorkspaceStats(params: {
  inbox: OrderSummary[];
  outbox: OrderSummary[];
  deliveries: DeliveryRecord[];
  products: SupplierProduct[];
}): WorkspaceStat[] {
  const pendingInbox = params.inbox.filter((order) => order.status === "created").length;
  return [
    { id: "inbox", label: "Inbox", value: String(params.inbox.length) },
    { id: "pending", label: "Pending", value: String(pendingInbox) },
    { id: "deliveries", label: "Deliveries", value: String(params.deliveries.length) },
    { id: "skus", label: "SKUs", value: String(params.products.length) },
  ];
}
