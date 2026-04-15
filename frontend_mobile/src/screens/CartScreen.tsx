import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import * as Location from "expo-location";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { type LatLng, validateLatLngInputs, validateSingleSupplierCart } from "@usc/core";
import { useQueryClient } from "@tanstack/react-query";
import { useCart } from "@/session/CartProvider";
import { useSelectedCompany } from "@/session/SelectedCompanyProvider";
import { useSession } from "@/session/SessionProvider";
import { useToast } from "@/providers/ToastProvider";
import { NotificationsAction } from "@/ui/AppHeaderAction";
import { FilterChip, FilterRow, HeroBanner, MetaTag, SectionCard, StatGrid, StatTile } from "@/ui/BusinessUI";
import { PrimaryButton, SecondaryButton } from "@/ui/Buttons";
import { EmptyState } from "@/ui/EmptyState";
import { MapPickerModal } from "@/ui/MapPickerModal";
import { Screen } from "@/ui/Screen";
import { TextField } from "@/ui/TextField";
import { palette } from "@/ui/theme";

const schema = z.object({
  address: z.string().min(1),
  comment: z.string().optional(),
  lat: z.string().optional(),
  lng: z.string().optional(),
  deliveryMode: z.enum(["SUPPLIER_COURIER", "BUYER_COURIER", "YANDEX"]),
});

type FormValues = z.infer<typeof schema>;

export function CartScreen() {
  const { items, total, inc, dec, remove, clear } = useCart();
  const { activeCompanyId, appRole } = useSelectedCompany();
  const { services } = useSession();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [mapOpen, setMapOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      address: "Mederova 161a",
      comment: "",
      lat: "",
      lng: "",
      deliveryMode: "SUPPLIER_COURIER",
    },
  });

  const linesValidation = validateSingleSupplierCart(items);
  const coordState = validateLatLngInputs(form.watch("lat") ?? "", form.watch("lng") ?? "");
  const selectedCoords = coordState.kind === "valid" ? coordState.coords : coords;

  if (appRole !== "buyer") {
    return (
      <Screen testID="screen-cart" title="Cart" subtitle="Buyer-only route" headerRight={<NotificationsAction />}>
        <EmptyState title="Cart is disabled in supplier mode" text="Switch to a buyer company to build a purchase basket and create orders." />
      </Screen>
    );
  }

  return (
    <Screen testID="screen-cart" title="Cart" subtitle={`${items.length} lines in current basket`} headerRight={<NotificationsAction />}>
      <HeroBanner
        eyebrow="Buyer checkout"
        title="Ready to place the order"
        text="Review the basket, confirm supplier consistency, then finish checkout with address and coordinates."
        aside={<MetaTag label={`${items.length} lines`} tone="primary" />}
      />

      <StatGrid>
        <StatTile label="Lines" value={items.length} />
        <StatTile label="Total" value={`${Math.round(total)} som`} />
        <StatTile label="Supplier check" value={linesValidation.ok ? "Single supplier" : "Blocked"} tone={linesValidation.ok ? "success" : "warning"} />
        <StatTile label="Location" value={selectedCoords ? "Selected" : "Missing"} tone={selectedCoords ? "success" : "neutral"} />
      </StatGrid>

      {items.length === 0 ? (
        <EmptyState title="Cart is empty" text="Add products from the catalog before creating an order." />
      ) : (
        <SectionCard title="Basket" subtitle="Adjust quantities or remove lines before checkout.">
          <View style={styles.list}>
          {items.map((line) => (
            <View style={styles.lineCard} key={line.product.id}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.lineTitle}>{line.product.name}</Text>
                <Text style={styles.lineMeta}>{line.product.seller}</Text>
                <Text style={styles.lineMeta}>{`${Math.round(line.product.price)} som x ${line.qty}`}</Text>
              </View>
              <View style={styles.lineActions}>
                <SecondaryButton onPress={() => dec(line.product.id)}>-</SecondaryButton>
                <Text style={styles.qty}>{line.qty}</Text>
                <SecondaryButton onPress={() => inc(line.product.id)}>+</SecondaryButton>
              </View>
              <SecondaryButton onPress={() => remove(line.product.id)}>Remove</SecondaryButton>
            </View>
          ))}
          </View>
          <SecondaryButton testID="cart-clear" onPress={clear}>Clear cart</SecondaryButton>
        </SectionCard>
      )}

      <SectionCard title="Checkout" subtitle="Address, delivery mode and geo point for the current buyer order.">
        {!activeCompanyId ? <Text style={styles.warning}>Select a buyer company before checkout.</Text> : null}
        {!linesValidation.ok && items.length > 0 ? (
          <Text style={styles.warning}>
            {linesValidation.reason === "multiple_suppliers"
              ? "Current cart mixes multiple suppliers. Buyer v1 allows one supplier per order."
              : "Products are missing supplier company mapping."}
          </Text>
        ) : null}

        <Controller
          control={form.control}
          name="address"
          render={({ field, fieldState }) => (
            <TextField testID="cart-address" label="Delivery address" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />
          )}
        />

        <Controller
          control={form.control}
          name="comment"
          render={({ field, fieldState }) => (
            <TextField testID="cart-comment" label="Comment (optional)" value={field.value ?? ""} onChangeText={field.onChange} error={fieldState.error?.message} />
          )}
        />

        <View style={styles.coordsRow}>
          <Controller
            control={form.control}
            name="lat"
            render={({ field }) => <TextField testID="cart-lat" label="Lat" value={field.value ?? ""} onChangeText={field.onChange} />}
          />
          <Controller
            control={form.control}
            name="lng"
            render={({ field }) => <TextField testID="cart-lng" label="Lng" value={field.value ?? ""} onChangeText={field.onChange} />}
          />
        </View>
        {coordState.message ? <Text style={styles.warning}>{coordState.message}</Text> : null}
        <Text style={styles.helperText}>
          {selectedCoords
            ? `Selected point: ${selectedCoords.lat.toFixed(6)}, ${selectedCoords.lng.toFixed(6)}`
            : "Use current location, enter coordinates manually, or pick the point on map."}
        </Text>

        <FilterRow>
          {(["SUPPLIER_COURIER", "BUYER_COURIER", "YANDEX"] as const).map((mode) => (
            <FilterChip
              testID={`cart-delivery-mode-${mode.toLowerCase()}`}
              key={mode}
              active={form.watch("deliveryMode") === mode}
              onPress={() => form.setValue("deliveryMode", mode)}
            >
              {mode}
            </FilterChip>
          ))}
        </FilterRow>

        <SecondaryButton
          testID="cart-use-current-location"
          onPress={async () => {
            const permission = await Location.requestForegroundPermissionsAsync();
            if (permission.status !== "granted") {
              toast.show("Location permission was not granted.", "error");
              return;
            }
            const current = await Location.getCurrentPositionAsync({});
            const nextCoords = {
              lat: Number(current.coords.latitude.toFixed(6)),
              lng: Number(current.coords.longitude.toFixed(6)),
            };
            setCoords(nextCoords);
            form.setValue("lat", String(nextCoords.lat));
            form.setValue("lng", String(nextCoords.lng));
          }}
        >
          Use current location
        </SecondaryButton>

        <SecondaryButton testID="cart-open-map-picker" onPress={() => setMapOpen(true)}>
          Pick on map
        </SecondaryButton>

        <PrimaryButton
          testID="cart-create-order"
          disabled={busy || items.length === 0 || !activeCompanyId || !linesValidation.ok}
          onPress={form.handleSubmit(async (values) => {
            if (!linesValidation.ok || !activeCompanyId) return;
            setBusy(true);
            try {
              const finalCoords = coordState.kind === "valid" ? coordState.coords : coords;
              const order = await services.ordersApi.create({
                deliveryAddress: values.address,
                deliveryLat: finalCoords?.lat ?? null,
                deliveryLng: finalCoords?.lng ?? null,
                comment: values.comment ?? "",
                buyerCompanyId: activeCompanyId,
                supplierCompanyId: linesValidation.supplierCompanyId,
                deliveryMode: values.deliveryMode,
                items: items.map((line) => ({
                  productId: Number(line.product.id),
                  qty: line.qty,
                })),
              });
              clear();
              await queryClient.invalidateQueries({ queryKey: ["orders"] });
              toast.show(`Order USC-${order.id} created.`, "success");
              router.push({ pathname: "/(app)/order/[orderId]", params: { orderId: String(order.id) } });
            } catch (error) {
              toast.show(error instanceof Error ? error.message : "Failed to create order.", "error");
            } finally {
              setBusy(false);
            }
          })}
        >
          {busy ? "Creating order..." : "Create order"}
        </PrimaryButton>
      </SectionCard>

      <MapPickerModal
        open={mapOpen}
        initialCoords={selectedCoords}
        onClose={() => setMapOpen(false)}
        onConfirm={(nextCoords) => {
          setCoords(nextCoords);
          form.setValue("lat", String(nextCoords.lat), { shouldValidate: true });
          form.setValue("lng", String(nextCoords.lng), { shouldValidate: true });
          setMapOpen(false);
          toast.show("Map point selected.", "success");
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 12,
  },
  lineCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: 16,
    gap: 12,
  },
  lineTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: palette.text,
  },
  lineMeta: {
    color: palette.muted,
    fontSize: 13,
  },
  lineActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  qty: {
    minWidth: 24,
    textAlign: "center",
    color: palette.text,
    fontWeight: "700",
  },
  coordsRow: {
    flexDirection: "row",
    gap: 12,
  },
  warning: {
    color: palette.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  helperText: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
  },
});
