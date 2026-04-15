import { useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Linking, StyleSheet, Text, View } from "react-native";
import { parseGeoTag, stripGeoTag, toOsmLink } from "@usc/core";
import { useSelectedCompany } from "@/session/SelectedCompanyProvider";
import { useSession } from "@/session/SessionProvider";
import { useToast } from "@/providers/ToastProvider";
import { NotificationsAction } from "@/ui/AppHeaderAction";
import { DataRow, DataStack, FilterChip, FilterRow, HeroBanner, InsetPanel, MetaTag, SectionCard, StatGrid, StatTile } from "@/ui/BusinessUI";
import { PrimaryButton, SecondaryButton } from "@/ui/Buttons";
import { EmptyState } from "@/ui/EmptyState";
import { Screen } from "@/ui/Screen";
import { deliveryStatusLabel, orderStatusLabel } from "@/screens/orderMeta";
import { buildOrderJourney, computeOrderTotal, deliveryStatusOptions, formatOrderCreatedAt, orderJourneyNote } from "@/screens/orderJourney";
import { palette } from "@/ui/theme";

function journeyTone(state: "done" | "current" | "pending") {
  if (state === "done") return "success" as const;
  if (state === "current") return "primary" as const;
  return "neutral" as const;
}

function journeyStateLabel(state: "done" | "current" | "pending") {
  if (state === "done") return "Completed";
  if (state === "current") return "Current";
  return "Pending";
}

function deliveryTone(status?: string | null) {
  const normalized = String(status ?? "").toUpperCase();
  if (normalized === "DELIVERED") return "success" as const;
  if (normalized === "FAILED" || normalized === "CANCELLED") return "danger" as const;
  if (normalized === "ASSIGNED" || normalized === "PICKED_UP" || normalized === "ON_THE_WAY") return "primary" as const;
  return "warning" as const;
}

export function OrderDetailScreen() {
  const params = useLocalSearchParams<{ orderId?: string }>();
  const orderId = Number(params.orderId ?? 0);
  const { activeCompanyId, appRole } = useSelectedCompany();
  const { services } = useSession();
  const toast = useToast();
  const queryClient = useQueryClient();

  const detailQuery = useQuery({
    queryKey: ["order", orderId, activeCompanyId, appRole],
    queryFn: () => services.ordersApi.fetchDetail(orderId, appRole === "buyer" ? activeCompanyId ?? undefined : undefined),
    enabled: Number.isFinite(orderId) && orderId > 0,
  });

  const deliveryQuery = useQuery({
    queryKey: ["delivery", orderId],
    queryFn: () => services.deliveriesApi.byOrder(orderId),
    enabled: Number.isFinite(orderId) && orderId > 0,
  });

  const order = detailQuery.data;
  const orderTotal = computeOrderTotal(order);
  const journeySteps = order ? buildOrderJourney(order.status) : [];
  const journeyNote = order ? orderJourneyNote(order.status) : null;
  const createdAtText = formatOrderCreatedAt(order);
  const geo =
    order?.deliveryLat != null && order?.deliveryLng != null
      ? { lat: order.deliveryLat, lng: order.deliveryLng }
      : parseGeoTag(order?.comment);
  const deliveryOptions = deliveryStatusOptions(deliveryQuery.data);
  const strippedComment = stripGeoTag(order?.comment);
  const hasActions =
    appRole === "buyer" ||
    (appRole === "supplier" && order?.status === "created") ||
    order?.status === "created" ||
    order?.status === "confirmed";

  return (
    <Screen
      testID="screen-order-detail"
      title={order ? `USC-${order.id}` : "Order detail"}
      subtitle={appRole === "supplier" ? "Supplier order detail" : "Buyer order detail"}
      headerRight={<NotificationsAction />}
    >
      {detailQuery.isLoading ? (
        <EmptyState title="Loading order" text="Fetching order detail for the active workspace." />
      ) : !order ? (
        <EmptyState title="Order not found" text="The requested buyer order detail is not available." />
      ) : (
        <View style={styles.stack}>
          <HeroBanner
            eyebrow="Order detail"
            title={`USC-${order.id}`}
            text={`${order.deliveryAddress || "No delivery address provided."}${createdAtText ? ` | Created ${createdAtText}` : ""}`}
            aside={
              <MetaTag
                label={orderStatusLabel(order.status)}
                tone={order.status === "cancelled" || order.status === "failed" ? "danger" : order.status === "delivered" ? "success" : "primary"}
              />
            }
          />

          <StatGrid>
            <StatTile label="Items" value={order.itemsCount ?? 0} />
            <StatTile label="Total" value={orderTotal != null ? `${Math.round(orderTotal)} som` : "-"} />
            <StatTile label="Geo point" value={geo ? "Available" : "Missing"} tone={geo ? "success" : "neutral"} />
            <StatTile label="Delivery" value={deliveryQuery.data ? deliveryStatusLabel(deliveryQuery.data.status) : "Pending"} tone={deliveryQuery.data ? "primary" : "warning"} />
          </StatGrid>

          <SectionCard title="Status" subtitle="Current order state, address and delivery point.">
            <DataStack>
              <DataRow title="Order state" body={orderStatusLabel(order.status)} meta={createdAtText ? `Created ${createdAtText}` : undefined} />
              <DataRow title="Delivery address" body={order.deliveryAddress || "No delivery address provided."} />
              {strippedComment ? <DataRow title="Comment" body={strippedComment} /> : null}
              <DataRow
                title="Geo point"
                body={geo ? `${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)}` : "No delivery coordinates attached."}
                trailing={<MetaTag label={geo ? "Ready" : "Missing"} tone={geo ? "success" : "warning"} />}
              />
            </DataStack>
            {geo ? (
              <SecondaryButton testID="order-open-geo" onPress={() => Linking.openURL(toOsmLink(geo))}>
                Open geo point
              </SecondaryButton>
            ) : null}
          </SectionCard>

          <SectionCard title="Journey" subtitle="Progression from creation to delivery.">
            <View testID="order-journey" style={styles.journeyList}>
              {journeySteps.map((step, index) => (
                <InsetPanel key={step.key} tone={journeyTone(step.state)}>
                  <View style={styles.journeyRow}>
                    <View
                      style={[
                        styles.journeyDot,
                        step.state === "done" && styles.journeyDotDone,
                        step.state === "current" && styles.journeyDotCurrent,
                      ]}
                    >
                      <Text
                        style={[
                          styles.journeyDotText,
                          step.state !== "pending" && styles.journeyDotTextActive,
                        ]}
                      >
                        {index + 1}
                      </Text>
                    </View>
                    <View style={styles.journeyCopy}>
                      <Text style={styles.itemName}>{step.label}</Text>
                      <Text style={styles.meta}>{journeyStateLabel(step.state)}</Text>
                    </View>
                    <MetaTag label={journeyStateLabel(step.state)} tone={journeyTone(step.state)} />
                  </View>
                </InsetPanel>
              ))}
            </View>
            {journeyNote ? (
              <InsetPanel tone="warning">
                <Text style={styles.warningNote}>{journeyNote}</Text>
              </InsetPanel>
            ) : null}
          </SectionCard>

          <SectionCard title="Items" subtitle="Snapshot of order lines and total value.">
            <DataStack>
              {(order.items ?? []).map((item, index) => (
                <DataRow
                  key={`${item.productId}-${index}`}
                  title={item.name ?? `Product #${item.productId}`}
                  body={`${item.qty} units`}
                  meta={`Product ID ${item.productId}`}
                  trailing={<MetaTag label={typeof item.priceSnapshot === "number" ? `${Math.round(item.priceSnapshot)} som` : "No price"} tone="primary" />}
                />
              ))}
            </DataStack>
            {orderTotal != null ? (
              <InsetPanel tone="primary">
                <View style={styles.totalRow}>
                  <Text style={styles.itemName}>Total</Text>
                  <Text style={styles.totalValue}>{`${Math.round(orderTotal)} som`}</Text>
                </View>
              </InsetPanel>
            ) : null}
          </SectionCard>

          <SectionCard title="Delivery" subtitle="Tracking, courier and current delivery state.">
            {deliveryQuery.isLoading ? (
              <Text style={styles.meta}>Loading delivery...</Text>
            ) : deliveryQuery.data ? (
              <>
                <InsetPanel tone={deliveryTone(deliveryQuery.data.status)}>
                  <Text style={styles.primaryValue}>{deliveryStatusLabel(deliveryQuery.data.status)}</Text>
                  <Text style={styles.meta}>Track the live delivery state, courier ownership and routing updates here.</Text>
                </InsetPanel>
                <DataStack>
                  {deliveryQuery.data.notes ? <DataRow title="Notes" body={deliveryQuery.data.notes} /> : null}
                  {deliveryQuery.data.courierId != null ? <DataRow title="Courier" body={`Courier ID ${deliveryQuery.data.courierId}`} /> : null}
                  {deliveryQuery.data.trackingLink ? (
                    <DataRow
                      title="Tracking"
                      body="External tracking link is available for this delivery."
                      trailing={<MetaTag label="Live link" tone="primary" />}
                    />
                  ) : null}
                </DataStack>
                {deliveryQuery.data.trackingLink ? (
                  <SecondaryButton testID="order-open-tracking" onPress={() => Linking.openURL(deliveryQuery.data?.trackingLink ?? "")}>
                    Open tracking link
                  </SecondaryButton>
                ) : null}
                <FilterRow>
                  {deliveryOptions.map((status) => {
                    const active = String(deliveryQuery.data?.status ?? "").toUpperCase() === status;
                    return (
                      <FilterChip
                        key={status}
                        testID={`order-delivery-status-${status}`}
                        active={active}
                        onPress={async () => {
                          if (!deliveryQuery.data || active) return;
                          try {
                            await services.deliveriesApi.setStatus(deliveryQuery.data.id, status);
                            await deliveryQuery.refetch();
                            await queryClient.invalidateQueries({ queryKey: ["deliveries"] });
                            await queryClient.invalidateQueries({ queryKey: ["orders"] });
                            toast.show(`Delivery moved to ${status}.`, "success");
                          } catch (error) {
                            toast.show(error instanceof Error ? error.message : "Failed to update delivery.", "error");
                          }
                        }}
                      >
                        {deliveryStatusLabel(status)}
                      </FilterChip>
                    );
                  })}
                </FilterRow>
              </>
            ) : (
              <Text style={styles.meta}>No delivery record is assigned yet.</Text>
            )}
          </SectionCard>

          {hasActions ? (
            <SectionCard title="Actions" subtitle="Next operational move for this order.">
              {appRole === "buyer" ? (
                <PrimaryButton
                  testID="order-repeat"
                  onPress={async () => {
                    if (!activeCompanyId || !order.items?.length || !order.supplierCompanyId) return;
                    try {
                      const result = await services.ordersApi.create({
                        buyerCompanyId: activeCompanyId,
                        supplierCompanyId: order.supplierCompanyId,
                        deliveryAddress: "Repeat order",
                        comment: `Repeat order from USC-${order.id}`,
                        deliveryMode: "SUPPLIER_COURIER",
                        items: order.items.map((item) => ({ productId: item.productId, qty: item.qty })),
                      });
                      await queryClient.invalidateQueries({ queryKey: ["orders"] });
                      await queryClient.invalidateQueries({ queryKey: ["order", order.id] });
                      toast.show(`Repeat order USC-${result.id} created.`, "success");
                    } catch (error) {
                      toast.show(error instanceof Error ? error.message : "Repeat order failed.", "error");
                    }
                  }}
                >
                  Repeat order
                </PrimaryButton>
              ) : null}

              {appRole === "supplier" && order.status === "created" ? (
                <PrimaryButton
                  testID="order-confirm"
                  onPress={async () => {
                    try {
                      await services.ordersApi.supplierConfirm(order.id);
                      await queryClient.invalidateQueries({ queryKey: ["orders"] });
                      await queryClient.invalidateQueries({ queryKey: ["order", order.id] });
                      await deliveryQuery.refetch();
                      toast.show(`Order USC-${order.id} confirmed.`, "success");
                    } catch (error) {
                      toast.show(error instanceof Error ? error.message : "Supplier confirm failed.", "error");
                    }
                  }}
                >
                  Confirm order
                </PrimaryButton>
              ) : null}

              {order.status === "created" || order.status === "confirmed" ? (
                <SecondaryButton
                  testID="order-cancel"
                  onPress={async () => {
                    try {
                      await services.ordersApi.cancel(order.id);
                      await queryClient.invalidateQueries({ queryKey: ["orders"] });
                      await queryClient.invalidateQueries({ queryKey: ["order", order.id] });
                      await deliveryQuery.refetch();
                      toast.show(`Order USC-${order.id} cancelled.`, "success");
                    } catch (error) {
                      toast.show(error instanceof Error ? error.message : "Cancel failed.", "error");
                    }
                  }}
                >
                  Cancel order
                </SecondaryButton>
              ) : null}
            </SectionCard>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 14,
  },
  primaryValue: {
    color: palette.text,
    fontSize: 20,
    fontWeight: "800",
  },
  meta: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  journeyList: {
    gap: 12,
  },
  journeyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  journeyDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.bg,
  },
  journeyCopy: {
    flex: 1,
    gap: 2,
  },
  journeyDotDone: {
    backgroundColor: "#D7F5DF",
    borderColor: "#8DD3A5",
  },
  journeyDotCurrent: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  journeyDotText: {
    color: palette.muted,
    fontWeight: "800",
    fontSize: 12,
  },
  journeyDotTextActive: {
    color: "#FFFFFF",
  },
  itemName: {
    color: palette.text,
    fontWeight: "700",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  totalValue: {
    color: palette.primary,
    fontWeight: "800",
  },
  warningNote: {
    color: palette.danger,
    fontSize: 13,
    lineHeight: 18,
  },
});
