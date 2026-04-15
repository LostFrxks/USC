import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { stripGeoTag } from "@usc/core";
import { useSelectedCompany } from "@/session/SelectedCompanyProvider";
import { useSession } from "@/session/SessionProvider";
import { useToast } from "@/providers/ToastProvider";
import { NotificationsAction } from "@/ui/AppHeaderAction";
import { FilterChip, FilterRow, SectionCard, StatGrid, StatTile } from "@/ui/BusinessUI";
import { PrimaryButton } from "@/ui/Buttons";
import { EmptyState } from "@/ui/EmptyState";
import { Screen } from "@/ui/Screen";
import { TextField } from "@/ui/TextField";
import { palette } from "@/ui/theme";
import { filterOrders, summarizeOrders, sortOrders, type OrderFilter } from "@/screens/ordersDashboard";
import { orderStatusLabel } from "@/screens/orderMeta";

type SupplierOrderMode = "buyer" | "inbox" | "outbox";

export function OrdersScreen() {
  const { activeCompanyId, appRole } = useSelectedCompany();
  const { services } = useSession();
  const toast = useToast();
  const [filter, setFilter] = useState<OrderFilter>("all");
  const [supplierMode, setSupplierMode] = useState<SupplierOrderMode>(appRole === "supplier" ? "inbox" : "buyer");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (appRole === "supplier") {
      setSupplierMode((current) => (current === "outbox" || current === "inbox" ? current : "inbox"));
      return;
    }
    setSupplierMode("buyer");
  }, [appRole]);

  const ordersQuery = useQuery({
    queryKey: ["orders", appRole, activeCompanyId, supplierMode],
    queryFn: () => {
      if (appRole === "supplier") {
        return supplierMode === "outbox" ? services.ordersApi.listOutbox() : services.ordersApi.listInbox();
      }
      return services.ordersApi.listBuyerOrders({ buyerCompanyId: activeCompanyId as number, limit: 50, offset: 0 });
    },
    enabled: appRole === "supplier" || Boolean(activeCompanyId),
  });

  const orders = useMemo(() => sortOrders(ordersQuery.data ?? []), [ordersQuery.data]);
  const filtered = useMemo(() => filterOrders(orders, query, filter), [filter, orders, query]);
  const stats = useMemo(() => summarizeOrders(orders), [orders]);

  return (
    <Screen
      testID="screen-orders"
      title="Orders"
      subtitle={appRole === "supplier" ? "Supplier inbox/outbox for the active company" : "Buyer order history for the active company"}
      headerRight={<NotificationsAction />}
    >
      {appRole === "supplier" ? (
        <FilterRow>
          <FilterChip testID="orders-supplier-mode-inbox" active={supplierMode === "inbox"} onPress={() => setSupplierMode("inbox")}>
            Inbox
          </FilterChip>
          <FilterChip testID="orders-supplier-mode-outbox" active={supplierMode === "outbox"} onPress={() => setSupplierMode("outbox")}>
            Outbox
          </FilterChip>
        </FilterRow>
      ) : null}

      <StatGrid>
        <StatTile label="All" value={stats.all} />
        <StatTile label="Active" value={stats.active} />
        <StatTile label="Delivered" value={stats.delivered} />
        <StatTile label="Cancelled" value={stats.cancelled} />
      </StatGrid>

      <SectionCard title="Order search" subtitle="Find orders by ID, address, comment, or status.">
        <TextField testID="orders-search" label="Search orders" value={query} onChangeText={setQuery} />
        <FilterRow>
          {(["all", "active", "delivered", "cancelled"] as const).map((item) => (
            <FilterChip testID={`orders-filter-${item}`} key={item} active={filter === item} onPress={() => setFilter(item)}>
              {item}
            </FilterChip>
          ))}
        </FilterRow>
      </SectionCard>

      {appRole !== "supplier" && !activeCompanyId ? (
        <EmptyState title="No buyer company selected" text="Select a company before loading buyer order history." />
      ) : ordersQuery.isLoading ? (
        <EmptyState title="Loading orders" text="Fetching buyer orders from the current company context." />
      ) : orders.length === 0 ? (
        <EmptyState title="No orders yet" text="Create a new order from cart or switch to another workspace." />
      ) : filtered.length === 0 ? (
        <EmptyState title="No orders in this view" text="Try another search phrase or filter." />
      ) : (
        <View style={styles.list}>
          {filtered.map((order) => (
            <SectionCard key={order.id}>
              <Pressable
                testID={`order-card-${order.id}`}
                style={styles.cardTap}
                onPress={() => router.push({ pathname: "/(app)/order/[orderId]", params: { orderId: String(order.id) } })}
              >
                <View style={styles.row}>
                  <Text style={styles.orderId}>{`USC-${order.id}`}</Text>
                  <Text style={styles.status}>{orderStatusLabel(order.status)}</Text>
                </View>
                <Text style={styles.meta}>{stripGeoTag(order.comment) || order.deliveryAddress || "Buyer flow order"}</Text>
                <Text style={styles.meta}>{`${order.itemsCount ?? 0} positions - ${Math.round(order.total ?? 0)} som`}</Text>
              </Pressable>
              {appRole === "supplier" && order.status === "created" ? (
                <PrimaryButton
                  testID={`order-confirm-inline-${order.id}`}
                  onPress={async () => {
                    try {
                      await services.ordersApi.supplierConfirm(order.id);
                      await ordersQuery.refetch();
                      toast.show(`Order USC-${order.id} confirmed.`, "success");
                    } catch (error) {
                      toast.show(error instanceof Error ? error.message : "Supplier confirm failed.", "error");
                    }
                  }}
                >
                  Confirm order
                </PrimaryButton>
              ) : null}
            </SectionCard>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 12,
  },
  cardTap: {
    gap: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  orderId: {
    color: palette.text,
    fontWeight: "800",
    fontSize: 16,
  },
  status: {
    color: palette.primary,
    fontWeight: "700",
  },
  meta: {
    color: palette.muted,
    fontSize: 13,
  },
});
