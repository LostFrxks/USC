import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AssignableCourier, DeliveryRecord } from "@usc/core";
import { StyleSheet, Text, View } from "react-native";
import { useSelectedCompany } from "@/session/SelectedCompanyProvider";
import { useSession } from "@/session/SessionProvider";
import { useToast } from "@/providers/ToastProvider";
import { NotificationsAction } from "@/ui/AppHeaderAction";
import { DataRow, DataStack, FilterChip, FilterRow, HeroBanner, InsetPanel, MetaTag, SectionCard, StatGrid, StatTile } from "@/ui/BusinessUI";
import { EmptyState } from "@/ui/EmptyState";
import { PrimaryButton, SecondaryButton } from "@/ui/Buttons";
import { Screen } from "@/ui/Screen";
import { TextField } from "@/ui/TextField";
import { palette } from "@/ui/theme";
import { deliveryStatusLabel } from "@/screens/orderMeta";

const DELIVERY_STATUSES = ["ASSIGNED", "PICKED_UP", "ON_THE_WAY", "DELIVERED", "FAILED"] as const;

type DeliveryEditorProps = {
  delivery: DeliveryRecord;
  onSaved: () => Promise<void>;
};

function courierLabel(courier: AssignableCourier): string {
  const name = `${courier.firstName} ${courier.lastName}`.trim();
  return name || courier.email || `Courier #${courier.id}`;
}

function deliveryTone(status?: string | null) {
  const normalized = String(status ?? "").toUpperCase();
  if (normalized === "DELIVERED") return "success" as const;
  if (normalized === "FAILED") return "danger" as const;
  if (normalized === "ASSIGNED" || normalized === "PICKED_UP" || normalized === "ON_THE_WAY") return "primary" as const;
  return "warning" as const;
}

function DeliveryEditor({ delivery, onSaved }: DeliveryEditorProps) {
  const { services } = useSession();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [trackingLink, setTrackingLink] = useState(delivery.trackingLink ?? "");
  const [notes, setNotes] = useState(delivery.notes ?? "");
  const [courierId, setCourierId] = useState<string>(delivery.courierId != null ? String(delivery.courierId) : "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTrackingLink(delivery.trackingLink ?? "");
    setNotes(delivery.notes ?? "");
    setCourierId(delivery.courierId != null ? String(delivery.courierId) : "");
  }, [delivery.courierId, delivery.notes, delivery.trackingLink]);

  const couriersQuery = useQuery({
    queryKey: ["deliveries", "couriers", delivery.orderId],
    queryFn: () => services.deliveriesApi.listAssignableCouriers(delivery.orderId),
    enabled: open,
  });

  return (
    <View style={styles.editorShell}>
      <SecondaryButton testID={`delivery-edit-toggle-${delivery.id}`} onPress={() => setOpen((value) => !value)}>{open ? "Hide edit form" : "Edit assignment"}</SecondaryButton>
      {open ? (
        <InsetPanel tone="neutral">
          <TextField testID={`delivery-tracking-link-${delivery.id}`} label="Tracking link" value={trackingLink} onChangeText={setTrackingLink} autoCapitalize="none" />
          <TextField testID={`delivery-notes-${delivery.id}`} label="Notes" value={notes} onChangeText={setNotes} multiline />
          <View style={styles.courierList}>
            <Text style={styles.sectionLabel}>Assignable couriers</Text>
            {couriersQuery.isLoading ? (
              <Text style={styles.helperText}>Loading couriers...</Text>
            ) : (couriersQuery.data ?? []).length === 0 ? (
              <Text style={styles.helperText}>No courier-enabled users were found in the buyer or supplier company.</Text>
            ) : (
              <FilterRow>
                {(couriersQuery.data ?? []).map((courier) => (
                  <FilterChip
                    key={courier.id}
                    testID={`delivery-courier-${delivery.id}-${courier.id}`}
                    active={courierId === String(courier.id)}
                    onPress={() => setCourierId((current) => (current === String(courier.id) ? "" : String(courier.id)))}
                  >
                    {courierLabel(courier)}
                  </FilterChip>
                ))}
              </FilterRow>
            )}
          </View>
          <PrimaryButton
            testID={`delivery-save-${delivery.id}`}
            disabled={saving}
            onPress={async () => {
              setSaving(true);
              try {
                await services.deliveriesApi.upsertForOrder({
                  orderId: delivery.orderId,
                  courierId: courierId ? Number(courierId) : null,
                  trackingLink,
                  notes,
                });
                await onSaved();
                setOpen(false);
                toast.show(`Delivery ${delivery.id} assignment updated.`, "success");
              } catch (error) {
                toast.show(error instanceof Error ? error.message : "Failed to update assignment.", "error");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving..." : "Save assignment"}
          </PrimaryButton>
        </InsetPanel>
      ) : null}
    </View>
  );
}

export function DeliveriesScreen() {
  const { appRole } = useSelectedCompany();
  const { services } = useSession();
  const toast = useToast();
  const queryClient = useQueryClient();

  const deliveriesQuery = useQuery({
    queryKey: ["deliveries", appRole],
    queryFn: () => services.deliveriesApi.list(),
    enabled: appRole === "supplier",
  });

  async function refreshDeliveries() {
    await queryClient.invalidateQueries({ queryKey: ["deliveries"] });
    await queryClient.invalidateQueries({ queryKey: ["orders"] });
  }

  const deliveries = deliveriesQuery.data ?? [];
  const assigned = deliveries.filter((delivery) => String(delivery.status || "").toUpperCase() === "ASSIGNED").length;
  const onTheWay = deliveries.filter((delivery) => String(delivery.status || "").toUpperCase() === "ON_THE_WAY").length;
  const delivered = deliveries.filter((delivery) => String(delivery.status || "").toUpperCase() === "DELIVERED").length;

  return (
    <Screen testID="screen-deliveries" title="Deliveries" subtitle="Supplier-side delivery control" headerRight={<NotificationsAction />}>
      {appRole !== "supplier" ? (
        <EmptyState title="Deliveries tab is supplier-only" text="Switch to a supplier company to update delivery status." />
      ) : deliveriesQuery.isLoading ? (
        <EmptyState title="Loading deliveries" text="Fetching current supplier delivery assignments." />
      ) : deliveries.length === 0 ? (
        <EmptyState title="No deliveries yet" text="Assigned supplier deliveries will appear here." />
      ) : (
        <View style={styles.stack}>
          <HeroBanner
            eyebrow="Supplier deliveries"
            title="Delivery operations"
            text="Track courier assignment, shipment progress and delivery blockers from one workspace."
            aside={<MetaTag label={`${deliveries.length} active`} tone="primary" />}
          />

          <StatGrid>
            <StatTile label="All" value={deliveries.length} />
            <StatTile label="Assigned" value={assigned} />
            <StatTile label="On the way" value={onTheWay} />
            <StatTile label="Delivered" value={delivered} tone="success" />
          </StatGrid>

          {deliveries.map((delivery) => (
            <SectionCard key={delivery.id} title={`Order USC-${delivery.orderId}`} subtitle="Current delivery assignment and status controls.">
              <InsetPanel tone={deliveryTone(delivery.status)}>
                <View style={styles.metaRow}>
                  <Text style={styles.title}>{deliveryStatusLabel(delivery.status)}</Text>
                  <MetaTag label={deliveryStatusLabel(delivery.status)} tone={deliveryTone(delivery.status)} />
                </View>
                <Text style={styles.body}>Use the controls below to move the shipment, assign a courier and keep routing notes current.</Text>
              </InsetPanel>
              <DataStack>
                <DataRow
                  title="Courier"
                  body={delivery.courierId != null ? `Courier ID ${delivery.courierId}` : "No courier assigned yet"}
                  trailing={<MetaTag label={delivery.courierId != null ? "Assigned" : "Unassigned"} tone={delivery.courierId != null ? "success" : "warning"} />}
                />
                {delivery.trackingLink ? <DataRow title="Tracking" body={delivery.trackingLink} /> : null}
                {delivery.notes ? <DataRow title="Delivery notes" body={delivery.notes} /> : null}
                {delivery.orderComment ? <DataRow title="Order comment" body={delivery.orderComment} /> : null}
              </DataStack>
              <InsetPanel tone="neutral">
                <Text style={styles.sectionLabel}>Delivery status</Text>
                <Text style={styles.helperText}>Tap the next shipment state to update this delivery.</Text>
                <FilterRow>
                  {DELIVERY_STATUSES.map((status) => (
                    <FilterChip
                      key={status}
                      active={String(delivery.status || "").toUpperCase() === status}
                      onPress={async () => {
                        try {
                          await services.deliveriesApi.setStatus(delivery.id, status);
                          await refreshDeliveries();
                          toast.show(`Delivery ${delivery.id} moved to ${status}.`, "success");
                        } catch (error) {
                          toast.show(error instanceof Error ? error.message : "Failed to update delivery.", "error");
                        }
                      }}
                    >
                      {deliveryStatusLabel(status)}
                    </FilterChip>
                  ))}
                </FilterRow>
              </InsetPanel>
              <DeliveryEditor delivery={delivery} onSaved={refreshDeliveries} />
            </SectionCard>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 14,
  },
  title: {
    color: palette.text,
    fontSize: 18,
    fontWeight: "800",
  },
  body: {
    color: palette.muted,
    lineHeight: 20,
  },
  helperText: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  editorShell: {
    gap: 10,
  },
  sectionLabel: {
    color: palette.text,
    fontWeight: "700",
    fontSize: 14,
  },
  courierList: {
    gap: 8,
  },
});
