import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import {
  buildCreatePublicationPayload,
  buildUpdatePublicationPayload,
  filterPublicationProducts,
  isLowStockPublication,
  isPublicationDraftDirty,
  makeEmptyPublicationDraft,
  makePublicationDraft,
  mergePublicationDrafts,
  summarizePublicationProducts,
  type PublicationDraft,
  type PublicationFilter,
} from "@/features/publicationsDraft";
import { useSelectedCompany } from "@/session/SelectedCompanyProvider";
import { useSession } from "@/session/SessionProvider";
import { useToast } from "@/providers/ToastProvider";
import { NotificationsAction } from "@/ui/AppHeaderAction";
import { DataRow, DataStack, FilterChip, FilterRow, HeroBanner, InsetPanel, MetaTag, SectionCard, StatGrid, StatTile } from "@/ui/BusinessUI";
import { PrimaryButton, SecondaryButton } from "@/ui/Buttons";
import { EmptyState } from "@/ui/EmptyState";
import { Screen } from "@/ui/Screen";
import { TextField } from "@/ui/TextField";

function money(value: number): string {
  return `${Math.round(value)} som`;
}

export function PublicationsScreen() {
  const { appRole, activeCompanyId } = useSelectedCompany();
  const { services } = useSession();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [createDraft, setCreateDraft] = useState<PublicationDraft>(makeEmptyPublicationDraft);
  const [drafts, setDrafts] = useState<Record<number, PublicationDraft>>({});
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<PublicationFilter>("all");

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => services.catalogApi.listCategories(),
  });

  const productsQuery = useQuery({
    queryKey: ["supplier-products", activeCompanyId],
    queryFn: () => services.catalogApi.listMySupplierProducts(activeCompanyId),
    enabled: appRole === "supplier" && Boolean(activeCompanyId),
  });

  useEffect(() => {
    setDrafts((prev) => mergePublicationDrafts(productsQuery.data ?? [], prev));
  }, [productsQuery.data]);

  if (appRole !== "supplier") {
    return (
      <Screen testID="screen-publications" title="Publications" subtitle="Supplier-only route" headerRight={<NotificationsAction />}>
        <EmptyState title="Supplier SKUs are disabled in buyer mode" text="Switch to a supplier company to manage product publications." />
      </Screen>
    );
  }

  const categories = categoriesQuery.data ?? [];
  const products = productsQuery.data ?? [];
  const visibleProducts = useMemo(() => filterPublicationProducts(products, drafts, search, filter), [drafts, filter, products, search]);
  const stats = useMemo(() => summarizePublicationProducts(products, drafts), [drafts, products]);

  return (
    <Screen testID="screen-publications" title="Publications" subtitle="Supplier SKU management" headerRight={<NotificationsAction />}>
      <HeroBanner
        eyebrow="Supplier catalog"
        title="Publication workspace"
        text="Manage supplier SKUs, track low stock and update catalog details from one mobile surface."
        aside={<MetaTag label={`${stats.all} SKUs`} tone="primary" />}
      />

      <StatGrid>
        <StatTile label="All SKUs" value={stats.all} />
        <StatTile label="In stock" value={stats.inStock} tone="success" />
        <StatTile label="Low stock" value={stats.lowStock} tone="warning" />
        <StatTile label="Inventory value" value={`${Math.round(stats.inventoryValue)} som`} />
      </StatGrid>

      <SectionCard title="Search and filter" subtitle="Search by SKU details and narrow the catalog by stock state.">
        <TextField testID="publication-search" label="Search SKUs" value={search} onChangeText={setSearch} />
        <FilterRow>
          {([
            { value: "all", label: "All" },
            { value: "in_stock", label: "In stock" },
            { value: "out_stock", label: "Out of stock" },
            { value: "low_stock", label: "Low stock" },
          ] as const).map((item) => (
            <FilterChip testID={`publication-filter-${item.value}`} key={item.value} active={filter === item.value} onPress={() => setFilter(item.value)}>
              {item.label}
            </FilterChip>
          ))}
        </FilterRow>
        <InsetPanel tone="neutral">
          <DataRow
            title="Visible SKUs"
            body={`${visibleProducts.length} of ${products.length} match the current search and stock filter.`}
            trailing={<MetaTag label={filter === "all" ? "All" : filter === "in_stock" ? "In stock" : filter === "out_stock" ? "Out of stock" : "Low stock"} tone="primary" />}
          />
        </InsetPanel>
      </SectionCard>

      <SectionCard title="Create new SKU" subtitle="Add a supplier publication with category, price and stock details.">
        <InsetPanel tone="neutral">
          <DataStack>
            <TextField testID="publication-create-name" label="Name" value={createDraft.name} onChangeText={(value) => setCreateDraft((prev) => ({ ...prev, name: value }))} />
            <TextField testID="publication-create-description" label="Description" value={createDraft.description} onChangeText={(value) => setCreateDraft((prev) => ({ ...prev, description: value }))} multiline />
            <TextField testID="publication-create-price" label="Price" value={createDraft.price} onChangeText={(value) => setCreateDraft((prev) => ({ ...prev, price: value }))} keyboardType="decimal-pad" />
            <TextField testID="publication-create-stock-qty" label="Stock qty" value={createDraft.stockQty} onChangeText={(value) => setCreateDraft((prev) => ({ ...prev, stockQty: value }))} keyboardType="decimal-pad" />
          </DataStack>
        </InsetPanel>
        <InsetPanel tone="neutral">
          <Text style={styles.sectionLabel}>Publication settings</Text>
          <FilterRow>
            <FilterChip testID="publication-create-in-stock" active={createDraft.inStock} onPress={() => setCreateDraft((prev) => ({ ...prev, inStock: !prev.inStock }))}>
              In stock
            </FilterChip>
            <FilterChip testID="publication-create-track-inventory" active={createDraft.trackInventory} onPress={() => setCreateDraft((prev) => ({ ...prev, trackInventory: !prev.trackInventory }))}>
              Track inventory
            </FilterChip>
          </FilterRow>
          <FilterRow>
            {categories.map((category, index) => (
              <FilterChip testID={`publication-create-category-${index}`} key={category.id} active={createDraft.categoryId === String(category.id)} onPress={() => setCreateDraft((prev) => ({ ...prev, categoryId: String(category.id) }))}>
                {category.name}
              </FilterChip>
            ))}
          </FilterRow>
        </InsetPanel>
        <PrimaryButton
          testID="publication-create-submit"
          onPress={async () => {
            if (!activeCompanyId) return;
            const create = buildCreatePublicationPayload(activeCompanyId, createDraft);
            if (!create.ok) {
              toast.show(create.message, "error");
              return;
            }
            try {
              await services.catalogApi.createSupplierProduct(create.payload);
              setCreateDraft(makeEmptyPublicationDraft());
              await queryClient.invalidateQueries({ queryKey: ["supplier-products"] });
              toast.show("Supplier SKU created.", "success");
            } catch (error) {
              toast.show(error instanceof Error ? error.message : "Failed to create supplier SKU.", "error");
            }
          }}
        >
          Create SKU
        </PrimaryButton>
      </SectionCard>

      {productsQuery.isLoading ? (
        <EmptyState title="Loading supplier catalog" text="Fetching supplier-controlled SKUs for the active company." />
      ) : products.length === 0 ? (
        <EmptyState title="No supplier SKUs yet" text="Create the first publication for the active supplier company." />
      ) : visibleProducts.length === 0 ? (
        <EmptyState title="No SKUs in this filter" text="Try another search phrase or switch the stock filter." />
      ) : (
        <View style={{ gap: 14 }}>
          {visibleProducts.map((product) => {
            const draft = drafts[product.id] ?? makePublicationDraft(product);
            const dirty = isPublicationDraftDirty(product, draft);
            const lowStock = isLowStockPublication(product, draft);
            return (
              <SectionCard key={product.id} title={product.name} subtitle={product.categoryName || "Uncategorized"}>
                <InsetPanel tone={dirty ? "danger" : lowStock ? "warning" : draft.inStock ? "success" : "neutral"}>
                  <View style={styles.productHead}>
                    <View style={styles.badgeStack}>
                      <MetaTag label={draft.inStock ? "In stock" : "Out"} tone={draft.inStock ? "success" : "neutral"} />
                      {lowStock ? <MetaTag label="Low stock" tone="warning" /> : null}
                      {dirty ? <MetaTag label="Unsaved" tone="danger" /> : null}
                    </View>
                  </View>
                  <DataStack>
                    <DataRow
                      title="Price"
                      body={draft.price ? money(Number(draft.price) || 0) : "No price set"}
                      trailing={<MetaTag label={draft.trackInventory ? "Tracked" : "Manual"} tone={draft.trackInventory ? "primary" : "neutral"} />}
                    />
                    <DataRow
                      title="Stock"
                      body={
                        draft.trackInventory
                          ? draft.stockQty
                            ? `${draft.stockQty} units`
                            : "0 units"
                          : "Inventory tracking is disabled"
                      }
                      meta={draft.categoryId ? `Category ID ${draft.categoryId}` : "No category linked"}
                    />
                  </DataStack>
                </InsetPanel>
                <InsetPanel tone="neutral">
                  <DataStack>
                    <TextField label="Name" value={draft.name} onChangeText={(value) => setDrafts((prev) => ({ ...prev, [product.id]: { ...draft, name: value } }))} />
                    <TextField label="Description" value={draft.description} onChangeText={(value) => setDrafts((prev) => ({ ...prev, [product.id]: { ...draft, description: value } }))} multiline />
                    <TextField label="Price" value={draft.price} onChangeText={(value) => setDrafts((prev) => ({ ...prev, [product.id]: { ...draft, price: value } }))} keyboardType="decimal-pad" />
                    <TextField label="Stock qty" value={draft.stockQty} onChangeText={(value) => setDrafts((prev) => ({ ...prev, [product.id]: { ...draft, stockQty: value } }))} keyboardType="decimal-pad" />
                  </DataStack>
                </InsetPanel>
                <InsetPanel tone="neutral">
                  <Text style={styles.sectionLabel}>SKU settings</Text>
                  <FilterRow>
                    <FilterChip active={draft.inStock} onPress={() => setDrafts((prev) => ({ ...prev, [product.id]: { ...draft, inStock: !draft.inStock } }))}>
                      In stock
                    </FilterChip>
                    <FilterChip active={draft.trackInventory} onPress={() => setDrafts((prev) => ({ ...prev, [product.id]: { ...draft, trackInventory: !draft.trackInventory } }))}>
                      Track inventory
                    </FilterChip>
                  </FilterRow>
                </InsetPanel>
                <View style={styles.rowActions}>
                  <PrimaryButton
                    testID={`publication-save-${product.id}`}
                    disabled={!dirty}
                    onPress={async () => {
                      const update = buildUpdatePublicationPayload(product, draft);
                      if (!update.ok) {
                        toast.show(update.message, "error");
                        return;
                      }
                      try {
                        await services.catalogApi.updateSupplierProduct(product.id, update.payload);
                        await queryClient.invalidateQueries({ queryKey: ["supplier-products"] });
                        toast.show(`Saved ${product.name}.`, "success");
                      } catch (error) {
                        toast.show(error instanceof Error ? error.message : "Failed to save SKU.", "error");
                      }
                    }}
                  >
                    Save
                  </PrimaryButton>
                  <SecondaryButton
                    testID={`publication-delete-${product.id}`}
                    onPress={async () => {
                      try {
                        await services.catalogApi.deleteSupplierProduct(product.id);
                        await queryClient.invalidateQueries({ queryKey: ["supplier-products"] });
                        toast.show(`Deleted ${product.name}.`, "success");
                      } catch (error) {
                        toast.show(error instanceof Error ? error.message : "Failed to delete SKU.", "error");
                      }
                    }}
                  >
                    Delete
                  </SecondaryButton>
                </View>
              </SectionCard>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowActions: {
    gap: 10,
  },
  productHead: {
    justifyContent: "flex-end",
  },
  badgeStack: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  sectionLabel: {
    color: "#1F1C17",
    fontWeight: "700",
    fontSize: 14,
  },
});
