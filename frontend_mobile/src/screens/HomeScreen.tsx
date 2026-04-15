import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import type { CatalogProduct } from "@usc/core";
import { router } from "expo-router";
import { catalogImages } from "@/assets/catalogImages";
import { useCart } from "@/session/CartProvider";
import { useSelectedCompany } from "@/session/SelectedCompanyProvider";
import { useSession } from "@/session/SessionProvider";
import { useToast } from "@/providers/ToastProvider";
import { NotificationsAction } from "@/ui/AppHeaderAction";
import { ActionCard, ActionGrid, HeroBanner, MetaTag, SectionCard } from "@/ui/BusinessUI";
import { EmptyState } from "@/ui/EmptyState";
import { ProductCard } from "@/ui/ProductCard";
import { ProductDetailsModal } from "@/ui/ProductDetailsModal";
import { Screen } from "@/ui/Screen";
import { palette } from "@/ui/theme";
import { buildSupplierWorkspaceStats } from "@/screens/homeWorkspace";

const CATEGORY_DECOR = [
  { id: 1, key: "meat", image: require("../../assets/home/meat.png") },
  { id: 2, key: "milk", image: require("../../assets/home/milk.png") },
  { id: 3, key: "fish", image: require("../../assets/home/fish.png") },
  { id: 4, key: "bread", image: require("../../assets/home/bread.png") },
  { id: 5, key: "fruit", image: require("../../assets/home/fruit.png") },
  { id: 6, key: "grain", image: require("../../assets/home/grain.png") },
] as const;

export function HomeScreen() {
  const { services } = useSession();
  const { activeCompany, activeCompanyId, appRole } = useSelectedCompany();
  const { add } = useCart();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(1);
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 180);
    return () => clearTimeout(timer);
  }, [query]);

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => services.catalogApi.listCategories(),
  });

  const productsQuery = useQuery({
    queryKey: ["products", categoryId ?? "all", debouncedQuery],
    queryFn: () => services.catalogApi.listProducts({ categoryId: categoryId ?? undefined, q: debouncedQuery || undefined }),
  });

  const selectedImage = selectedProduct ? catalogImages[selectedProduct.categoryKey] ?? catalogImages.default : catalogImages.default;
  const products = productsQuery.data ?? [];

  const supplierInboxQuery = useQuery({
    queryKey: ["home", "supplier-inbox", activeCompanyId],
    queryFn: () => services.ordersApi.listInbox(),
    enabled: appRole === "supplier" && Boolean(activeCompanyId),
  });
  const supplierOutboxQuery = useQuery({
    queryKey: ["home", "supplier-outbox", activeCompanyId],
    queryFn: () => services.ordersApi.listOutbox(),
    enabled: appRole === "supplier" && Boolean(activeCompanyId),
  });
  const supplierDeliveriesQuery = useQuery({
    queryKey: ["home", "supplier-deliveries", activeCompanyId],
    queryFn: () => services.deliveriesApi.list(),
    enabled: appRole === "supplier" && Boolean(activeCompanyId),
  });
  const supplierProductsQuery = useQuery({
    queryKey: ["home", "supplier-products", activeCompanyId],
    queryFn: () => services.catalogApi.listMySupplierProducts(activeCompanyId),
    enabled: appRole === "supplier" && Boolean(activeCompanyId),
  });

  const supplierStats = useMemo(
    () =>
      buildSupplierWorkspaceStats({
        inbox: supplierInboxQuery.data ?? [],
        outbox: supplierOutboxQuery.data ?? [],
        deliveries: supplierDeliveriesQuery.data ?? [],
        products: supplierProductsQuery.data ?? [],
      }),
    [supplierDeliveriesQuery.data, supplierInboxQuery.data, supplierOutboxQuery.data, supplierProductsQuery.data]
  );

  const categoryButtons = useMemo(() => {
    const categories = categoriesQuery.data ?? [];
    return CATEGORY_DECOR.map((decor) => {
      const category = categories.find((item) => item.id === decor.id);
      return {
        id: decor.id,
        image: decor.image,
        name: category?.name ?? decor.key,
      };
    });
  }, [categoriesQuery.data]);

  if (appRole === "supplier") {
    return (
      <Screen testID="screen-home-supplier" title="Supplier Hub" subtitle={`Supplier workspace for ${activeCompany?.name ?? "selected company"}.`} headerRight={<NotificationsAction />}>
        <HeroBanner
          eyebrow="Supplier workspace"
          title={activeCompany?.name ?? "Supplier workspace"}
          text="Handle supplier orders, deliveries, SKUs and revenue signals from one mobile dashboard."
        />

        <ActionGrid>
          {supplierStats.map((item) => (
            <ActionCard key={item.id} title={item.label} text={String(item.value)} />
          ))}
          <ActionCard testID="supplier-hub-publications" title="Manage SKUs" text="Create, update and remove supplier publications for the active company." onPress={() => router.push("/(app)/(tabs)/publications")} />
          <ActionCard testID="supplier-hub-orders" title="Inbox / Outbox" text="Review supplier-side orders, confirm them and track the pipeline." onPress={() => router.push("/(app)/(tabs)/orders")} />
          <ActionCard testID="supplier-hub-deliveries" title="Deliveries" text="Update assignment and shipment status for active supplier deliveries." onPress={() => router.push("/(app)/(tabs)/deliveries")} />
          <ActionCard testID="open-analytics" title="Analytics" text="Review supplier metrics, revenue health and recommended actions." onPress={() => router.push("/(app)/analytics")} />
          <ActionCard testID="open-ai" title="AI Workspace" text="Ask analytics questions and run compact what-if scenarios." onPress={() => router.push("/(app)/ai")} />
        </ActionGrid>
      </Screen>
    );
  }

  return (
    <Screen testID="screen-home" title="Home" subtitle="Browse USC catalog" headerRight={<NotificationsAction />}>
      <View style={styles.homeCard}>
        <View style={styles.logoRow}>
          <Image source={require("../../assets/home/usc.png")} style={styles.logo} resizeMode="contain" />
        </View>

        <View style={styles.searchBox}>
          <Pressable style={styles.searchIconButton}>
            <Image source={require("../../assets/home/search.png")} style={styles.searchIcon} resizeMode="contain" />
          </Pressable>
          <TextInput
            testID="home-search"
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Искать товар или поставщика"
            placeholderTextColor={palette.muted}
          />
          <Pressable style={styles.clearButton} onPress={() => setQuery("")}>
            <Text style={styles.clearButtonText}>×</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesRow}>
          {categoryButtons.map((item) => {
            const active = categoryId === item.id;
            return (
              <Pressable
                key={item.id}
                testID={`category-chip-${item.id}`}
                style={[styles.categoryButton, active && styles.categoryButtonActive]}
                onPress={() => setCategoryId(item.id)}
              >
                <Image source={item.image} style={styles.categoryImage} resizeMode="contain" />
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.premiumBanner}>
          <Text style={styles.premiumText}>USC Премиум</Text>
        </View>

        <View style={styles.productGrid}>
          {productsQuery.isLoading ? (
            <EmptyState title="Загрузка каталога" text="Получаем товары для текущей категории." />
          ) : products.length === 0 ? (
            <EmptyState title="Ничего не найдено" text="Попробуйте другой запрос или переключите категорию." />
          ) : (
            products.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                imageSource={catalogImages[product.categoryKey] ?? catalogImages.default}
                cardTestID={`home-product-card-${index}`}
                addButtonTestID={`home-product-add-${index}`}
                onOpen={() => setSelectedProduct(product)}
                onAdd={() => {
                  add(product);
                  toast.show(`${product.name} added to cart.`, "success");
                }}
              />
            ))
          )}
        </View>
      </View>

      <ProductDetailsModal
        product={selectedProduct}
        open={Boolean(selectedProduct)}
        imageSource={selectedImage}
        onClose={() => setSelectedProduct(null)}
        onAdd={() => {
          if (!selectedProduct) return;
          add(selectedProduct);
          toast.show(`${selectedProduct.name} added to cart.`, "success");
          setSelectedProduct(null);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  homeCard: {
    marginTop: 8,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.96)",
    paddingTop: 18,
    paddingBottom: 44,
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
    overflow: "hidden",
  },
  logoRow: {
    paddingHorizontal: 14,
    alignItems: "center",
  },
  logo: {
    width: 120,
    height: 32,
  },
  searchBox: {
    marginTop: 10,
    marginHorizontal: 14,
    marginBottom: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    minHeight: 48,
  },
  searchIconButton: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  searchIcon: {
    width: 18,
    height: 18,
  },
  searchInput: {
    flex: 1,
    color: palette.text,
    fontSize: 14,
    paddingVertical: 0,
  },
  clearButton: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  clearButtonText: {
    color: palette.muted,
    fontSize: 18,
    lineHeight: 18,
  },
  categoriesRow: {
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  categoryButton: {
    width: 44,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 7,
  },
  categoryButtonActive: {
    backgroundColor: "rgba(136,181,255,0.18)",
    shadowColor: "#244A96",
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  categoryImage: {
    width: 34,
    height: 34,
  },
  premiumBanner: {
    marginHorizontal: 14,
    marginBottom: 12,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: palette.primary,
  },
  premiumText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  productGrid: {
    paddingHorizontal: 14,
    gap: 12,
  },
});
