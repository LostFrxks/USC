import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSession } from "@/session/SessionProvider";
import { useSelectedCompany } from "@/session/SelectedCompanyProvider";
import { DataRow, DataStack, FilterChip, FilterRow, HeroBanner, InsetPanel, MetaTag, SectionCard, StatGrid, StatTile } from "@/ui/BusinessUI";
import { Screen } from "@/ui/Screen";
import { EmptyState } from "@/ui/EmptyState";
import { PrimaryButton, SecondaryButton } from "@/ui/Buttons";
import { useToast } from "@/providers/ToastProvider";
import { TextField } from "@/ui/TextField";
import { classifyNotification, filterNotifications, notificationStats, type NotificationFilter } from "@/screens/notificationsCenter";

function bucketTone(bucket: "orders" | "deliveries" | "system") {
  if (bucket === "orders") return "primary" as const;
  if (bucket === "deliveries") return "warning" as const;
  return "neutral" as const;
}

function notificationPanelTone(bucket: "orders" | "deliveries" | "system", isRead: boolean) {
  if (isRead) return "neutral" as const;
  if (bucket === "orders") return "primary" as const;
  if (bucket === "deliveries") return "warning" as const;
  return "accent" as const;
}

export function NotificationsScreen() {
  const { services } = useSession();
  const { appRole } = useSelectedCompany();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const notificationsQuery = useQuery({
    queryKey: ["notifications", "list"],
    queryFn: () => services.notificationsApi.list(30),
  });

  const items = notificationsQuery.data?.items ?? [];
  const stats = useMemo(() => notificationStats(items), [items]);
  const visibleItems = useMemo(() => filterNotifications(items, query, filter), [filter, items, query]);

  function extractOrderId(item: (typeof items)[number]): number | null {
    if (item.resourceType === "order") {
      const id = Number(item.resourceId);
      if (Number.isFinite(id) && id > 0) return id;
    }
    const payloadId = Number(item.payload?.order_id);
    if (Number.isFinite(payloadId) && payloadId > 0) return payloadId;
    return null;
  }

  function extractStatus(item: (typeof items)[number]): string | null {
    return typeof item.payload?.status === "string" ? item.payload.status : null;
  }

  return (
    <Screen testID="screen-notifications" title="Notifications" subtitle={`Unread: ${notificationsQuery.data?.unreadCount ?? 0}`}>
      <View style={{ gap: 12 }}>
        <HeroBanner
          eyebrow="Operational inbox"
          title="Notification center"
          text="Review order, delivery and system signals from one mobile inbox and move directly into the next action."
          aside={<MetaTag label={`${stats.unread} unread`} tone={stats.unread > 0 ? "warning" : "success"} />}
        />

        <StatGrid>
          <StatTile label="All" value={stats.all} />
          <StatTile label="Unread" value={stats.unread} />
          <StatTile label="Orders" value={stats.orders} />
          <StatTile label="Deliveries" value={stats.deliveries} />
        </StatGrid>

        <SectionCard title="Inbox controls" subtitle="Search, narrow and clear operational notifications quickly.">
          <TextField testID="notifications-search" label="Search notifications" value={query} onChangeText={setQuery} />
          <FilterRow>
            {(["all", "unread", "orders", "deliveries", "system"] as const).map((item) => (
              <FilterChip testID={`notifications-filter-${item}`} key={item} active={filter === item} onPress={() => setFilter(item)}>
                {item}
              </FilterChip>
            ))}
          </FilterRow>
          <InsetPanel tone="neutral">
            <DataRow
              title="Current inbox view"
              body={`${visibleItems.length} of ${items.length} notifications match the active search and filter.`}
              meta={`System ${stats.system} | Orders ${stats.orders} | Deliveries ${stats.deliveries}`}
              trailing={<MetaTag label={filter} tone="primary" />}
            />
          </InsetPanel>
          <PrimaryButton
            testID="notifications-mark-all"
            onPress={async () => {
              try {
                await services.notificationsApi.markAllRead();
                await queryClient.invalidateQueries({ queryKey: ["notifications"] });
              } catch (error) {
                toast.show(error instanceof Error ? error.message : "Failed to mark all as read.", "error");
              }
            }}
          >
            Mark all as read
          </PrimaryButton>
        </SectionCard>

        {notificationsQuery.isLoading ? (
          <EmptyState title="Loading notifications" text="Fetching in-app notification feed." />
        ) : items.length === 0 ? (
          <EmptyState title="No notifications yet" text="Order and delivery events will show up here." />
        ) : visibleItems.length === 0 ? (
          <EmptyState title="No notifications in this filter" text="Try another filter or search phrase." />
        ) : (
          <DataStack>
            {visibleItems.map((item) => {
              const orderId = extractOrderId(item);
              const status = extractStatus(item);
              const confirmable = appRole === "supplier" && (status === "PENDING" || status === "CREATED");
              const bucket = classifyNotification(item);
              return (
                <SectionCard key={item.id} testID={`notification-card-${item.id}`}>
                  <InsetPanel tone={notificationPanelTone(bucket, item.isRead)}>
                    <View style={styles.cardBody}>
                      <View style={styles.headerTags}>
                        <MetaTag label={bucket} tone={bucketTone(bucket)} />
                        <MetaTag label={item.isRead ? "Read" : "Unread"} tone={item.isRead ? "neutral" : "warning"} />
                      </View>
                      <DataRow title={item.title} body={item.text} meta={item.domain} />
                    </View>
                  </InsetPanel>
                  <View style={styles.actions}>
                    {!item.isRead ? (
                      <SecondaryButton
                        testID={`notification-read-${item.id}`}
                        onPress={async () => {
                          await services.notificationsApi.markRead(item.id);
                          await queryClient.invalidateQueries({ queryKey: ["notifications"] });
                        }}
                      >
                        Mark read
                      </SecondaryButton>
                    ) : null}
                    {orderId ? (
                      <PrimaryButton
                        testID={`notification-open-order-${orderId}`}
                        onPress={async () => {
                          await services.notificationsApi.markRead(item.id).catch(() => undefined);
                          await queryClient.invalidateQueries({ queryKey: ["notifications"] });
                          router.push({ pathname: "/(app)/order/[orderId]", params: { orderId: String(orderId) } });
                        }}
                      >
                        Open order
                      </PrimaryButton>
                    ) : null}
                    {confirmable && orderId ? (
                      <PrimaryButton
                        testID={`notification-confirm-order-${orderId}`}
                        onPress={async () => {
                          try {
                            await services.ordersApi.supplierConfirm(orderId);
                            await services.notificationsApi.markRead(item.id).catch(() => undefined);
                            await queryClient.invalidateQueries({ queryKey: ["notifications"] });
                            await queryClient.invalidateQueries({ queryKey: ["orders"] });
                            toast.show(`Order USC-${orderId} confirmed.`, "success");
                          } catch (error) {
                            toast.show(error instanceof Error ? error.message : "Supplier confirm failed.", "error");
                          }
                        }}
                      >
                        Confirm order
                      </PrimaryButton>
                    ) : null}
                  </View>
                </SectionCard>
              );
            })}
          </DataStack>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardBody: {
    gap: 10,
  },
  actions: {
    gap: 10,
  },
  headerTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
