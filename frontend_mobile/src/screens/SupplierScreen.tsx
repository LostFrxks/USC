import { useMemo, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { CatalogProduct } from "@usc/core";
import { Text, View } from "react-native";
import { catalogImages } from "@/assets/catalogImages";
import { useCart } from "@/session/CartProvider";
import { useSession } from "@/session/SessionProvider";
import { useToast } from "@/providers/ToastProvider";
import { NotificationsAction } from "@/ui/AppHeaderAction";
import { DataRow, HeroBanner, InsetPanel, MetaTag, SectionCard, StatGrid, StatTile } from "@/ui/BusinessUI";
import { EmptyState } from "@/ui/EmptyState";
import { ProductCard } from "@/ui/ProductCard";
import { ProductDetailsModal } from "@/ui/ProductDetailsModal";
import { Screen } from "@/ui/Screen";
import { TextField } from "@/ui/TextField";

function money(value: number): string {
  return `${Math.round(value)} som`;
}

export function SupplierScreen() {
  const params = useLocalSearchParams<{ supplierId?: string; supplierName?: string }>();
  const supplierId = params.supplierId ?? "";
  const supplierName = params.supplierName ?? "Supplier";
  const { services } = useSession();
  const { add } = useCart();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);

  const productsQuery = useQuery({
    queryKey: ["supplier-products", supplierId, query],
    queryFn: () => services.catalogApi.listProducts({ supplierId, q: query || undefined }),
    enabled: Boolean(supplierId),
  });

  const products = productsQuery.data ?? [];
  const selectedImage = selectedProduct ? catalogImages[selectedProduct.categoryKey] ?? catalogImages.default : catalogImages.default;
  const subtitle = useMemo(() => `Focused supplier catalog for ${supplierName}.`, [supplierName]);
  const stats = useMemo(() => {
    if (products.length === 0) {
      return { categories: 0, reviews: 0, priceFloor: 0 };
    }
    return {
      categories: new Set(products.map((product) => product.categoryKey)).size,
      reviews: products.reduce((sum, product) => sum + product.reviews, 0),
      priceFloor: Math.min(...products.map((product) => product.price)),
    };
  }, [products]);

  return (
    <Screen testID="screen-supplier" title={supplierName} subtitle={subtitle} headerRight={<NotificationsAction />}>
      <HeroBanner
        eyebrow="Supplier catalog"
        title={supplierName}
        text="Review this supplier's products, search inside the catalog and add the right items into the cart."
        aside={<MetaTag label={`${products.length} items`} tone="primary" />}
      />

      <StatGrid>
        <StatTile label="Items" value={products.length} />
        <StatTile label="Categories" value={stats.categories} tone="neutral" />
        <StatTile label="Starting at" value={products.length ? money(stats.priceFloor) : "-"} tone="neutral" />
        <StatTile label="Reviews" value={stats.reviews} tone="neutral" />
      </StatGrid>

      <SectionCard title="Catalog search" subtitle="Search inside this supplier catalog and narrow the results before opening a product.">
        <TextField testID="supplier-search" label="Search inside supplier catalog" value={query} onChangeText={setQuery} />
        <InsetPanel tone="neutral">
          <DataRow
            title="Current result set"
            body={`${products.length} products match the current supplier filter.`}
            meta="Open a product for full details or add it directly to the cart."
            trailing={<MetaTag label={query.trim() ? "Filtered" : "All"} tone="primary" />}
          />
        </InsetPanel>
      </SectionCard>
      {productsQuery.isLoading ? (
        <EmptyState title="Loading supplier catalog" text="Fetching products for this supplier." />
      ) : products.length === 0 ? (
        <EmptyState title="No supplier products" text="This supplier does not have products matching the current query." />
      ) : (
        <SectionCard title="Supplier products" subtitle="Open a product card or add it directly to the cart.">
          <View style={{ gap: 14 }}>
          {products.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              imageSource={catalogImages[product.categoryKey] ?? catalogImages.default}
              cardTestID={`supplier-product-card-${index}`}
              addButtonTestID={`supplier-product-add-${index}`}
              onOpen={() => setSelectedProduct(product)}
              onAdd={() => {
                add(product);
                toast.show(`${product.name} added to cart.`, "success");
              }}
            />
          ))}
          </View>
        </SectionCard>
      )}

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
