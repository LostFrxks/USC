import type { CatalogImageKey } from "@usc/core";

export const catalogImages: Record<CatalogImageKey, number> = {
  meat: require("../../assets/catalog/meat.jpg"),
  milk: require("../../assets/catalog/milk.jpg"),
  fish: require("../../assets/catalog/fish.jpg"),
  bread: require("../../assets/catalog/bread.jpg"),
  fruit: require("../../assets/catalog/fruit.jpg"),
  grain: require("../../assets/catalog/grain.jpg"),
  default: require("../../assets/catalog/meat.jpg"),
};
