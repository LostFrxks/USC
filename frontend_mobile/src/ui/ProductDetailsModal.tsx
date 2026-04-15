import { Image, Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import type { CatalogProduct } from "@usc/core";
import { DataRow, InsetPanel, MetaTag } from "@/ui/BusinessUI";
import { palette } from "@/ui/theme";
import { PrimaryButton, SecondaryButton } from "@/ui/Buttons";
import { SheetFrame } from "@/ui/SheetFrame";

function factRows(product: CatalogProduct) {
  return [
    product.shelfLifeDays ? { title: "Shelf life", body: `${product.shelfLifeDays} days` } : null,
    product.storageCondition ? { title: "Storage", body: product.storageCondition } : null,
    product.originCountry ? { title: "Origin", body: product.originCountry } : null,
    product.brand ? { title: "Brand", body: product.brand } : null,
    product.manufacturer ? { title: "Manufacturer", body: product.manufacturer } : null,
  ].filter(Boolean) as Array<{ title: string; body: string }>;
}

export function ProductDetailsModal({
  product,
  imageSource,
  open,
  onClose,
  onAdd,
}: {
  product: CatalogProduct | null;
  imageSource: number;
  open: boolean;
  onClose: () => void;
  onAdd: () => void;
}) {
  if (!product) return null;
  const facts = factRows(product);

  return (
    <Modal animationType="slide" visible={open} transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <SheetFrame
          eyebrow={product.seller}
          title={product.name}
          subtitle={`${Math.round(product.price)} som`}
          footer={
            <>
              <SecondaryButton onPress={onClose}>Close</SecondaryButton>
              <PrimaryButton onPress={onAdd}>Add to cart</PrimaryButton>
            </>
          }
        >
          <ScrollView contentContainerStyle={styles.content}>
            <Image source={imageSource} style={styles.image} resizeMode="cover" />
            <View style={styles.metaRow}>
              <MetaTag label={`${product.rating} rating`} tone="primary" />
              <MetaTag label={`${product.reviews} reviews`} tone="neutral" />
              {product.brand ? <MetaTag label={product.brand} tone="accent" /> : null}
            </View>
            {product.description ? (
              <InsetPanel tone="neutral">
                <Text style={styles.description}>{product.description}</Text>
              </InsetPanel>
            ) : null}
            {facts.length ? (
              <InsetPanel tone="neutral">
                <View style={styles.facts}>
                  {facts.map((fact) => (
                    <DataRow key={fact.title} title={fact.title} body={fact.body} />
                  ))}
                </View>
              </InsetPanel>
            ) : null}
          </ScrollView>
        </SheetFrame>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "#00000055",
    justifyContent: "flex-end",
  },
  content: {
    paddingBottom: 18,
    paddingHorizontal: 16,
    maxHeight: "76%",
    gap: 14,
  },
  image: {
    width: "auto",
    height: 220,
    marginHorizontal: -16,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  description: {
    color: palette.text,
    fontSize: 15,
    lineHeight: 22,
  },
  facts: {
    gap: 8,
  },
});
