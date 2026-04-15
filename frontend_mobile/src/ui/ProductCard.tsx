import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { CatalogProduct } from "@usc/core";
import { cardShadow, palette } from "@/ui/theme";

function compactFacts(product: CatalogProduct): string[] {
  return [
    product.shelfLifeDays ? `Shelf ${product.shelfLifeDays}d` : null,
    product.storageCondition ? product.storageCondition : null,
    product.originCountry ? product.originCountry : null,
  ].filter(Boolean) as string[];
}

export function ProductCard({
  product,
  imageSource,
  onAdd,
  onOpen,
  cardTestID,
  addButtonTestID,
}: {
  product: CatalogProduct;
  imageSource: number;
  onAdd: () => void;
  onOpen: () => void;
  cardTestID?: string;
  addButtonTestID?: string;
}) {
  const facts = compactFacts(product).slice(0, 2);
  return (
    <Pressable testID={cardTestID ?? `product-card-${product.id}`} style={styles.card} onPress={onOpen}>
      <Image source={imageSource} style={styles.image} resizeMode="cover" />
      <View style={styles.body}>
        <View style={styles.metaRow}>
          <Text style={styles.eyebrow}>{product.seller}</Text>
          <View style={styles.ratingPill}>
            <Text style={styles.ratingText}>{`${product.rating} · ${product.reviews}`}</Text>
          </View>
        </View>
        <Text style={styles.name}>{product.name}</Text>
        {product.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {product.description}
          </Text>
        ) : null}
        {facts.length ? (
          <View style={styles.factRow}>
            {facts.map((fact) => (
              <View key={fact} style={styles.factPill}>
                <Text style={styles.factText}>{fact}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.footer}>
          <View style={styles.pricePill}>
            <Text style={styles.priceLabel}>Price</Text>
            <Text style={styles.price}>{`${Math.round(product.price)} som`}</Text>
          </View>
          <Pressable testID={addButtonTestID ?? `product-add-${product.id}`} style={styles.button} onPress={onAdd}>
            <Text style={styles.buttonText}>Add to cart</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    ...cardShadow,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: 168,
  },
  body: {
    padding: 16,
    gap: 8,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  eyebrow: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  ratingPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.bg,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  ratingText: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  name: {
    fontSize: 17,
    fontWeight: "700",
    color: palette.text,
  },
  description: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  factRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  factPill: {
    borderRadius: 999,
    backgroundColor: palette.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  factText: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: "700",
  },
  footer: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pricePill: {
    minWidth: 92,
    borderRadius: 16,
    backgroundColor: palette.bg,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
  },
  priceLabel: {
    color: palette.muted,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  price: {
    fontSize: 15,
    fontWeight: "800",
    color: palette.primary,
  },
  button: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
