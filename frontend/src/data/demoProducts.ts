import type { Product } from "../types";

export const DEMO_PRODUCTS_BY_CATEGORY: Record<string, Omit<Product, "id">[]> = {
  meat: [
    { name: "Мраморная говядина", seller: "Умар", price: 780, rating: "4.9", reviews: 85, image: "media/card_meat1.jpg", category: "meat" },
    { name: "Рёбрышки", seller: "Prime Meat", price: 950, rating: "4.8", reviews: 64, image: "media/card_meat2.jpg", category: "meat" },
    { name: "Куриные грудки", seller: "Local Farm", price: 420, rating: "4.7", reviews: 37, image: "media/card_meat3.jpg", category: "meat" },
    { name: "Фарш говяжий", seller: "Алтын Эт", price: 650, rating: "4.6", reviews: 28, image: "media/card_meat4.jpg", category: "meat" },
    { name: "Баранина на кости", seller: "Nomad Meat", price: 730, rating: "4.8", reviews: 52, image: "media/card_meat5.jpg", category: "meat" },
    { name: "Оптовые поставки мяса", seller: "USC партнёр", price: 0, rating: "5.0", reviews: 12, image: "media/card_meat6.jpg", category: "meat" },
  ],
  milk: [
    { name: "Молоко 3.2%", seller: "FreshMilk", price: 65, rating: "4.9", reviews: 93, image: "media/card_milk1.jpg", category: "milk" },
    { name: "Домашний кефир", seller: "Village Farm", price: 70, rating: "4.7", reviews: 41, image: "media/card_milk2.jpg", category: "milk" },
    { name: "Сметана 20%", seller: "Dairy Pro", price: 85, rating: "4.8", reviews: 56, image: "media/card_milk3.jpg", category: "milk" },
    { name: "Творог зерненый", seller: "Eco Milk", price: 110, rating: "4.6", reviews: 33, image: "media/card_milk4.jpg", category: "milk" },
    { name: "Йогурт питьевой", seller: "City Dairy", price: 55, rating: "4.5", reviews: 27, image: "media/card_milk5.jpg", category: "milk" },
    { name: "Молочные поставки", seller: "USC партнёр", price: 0, rating: "4.9", reviews: 18, image: "media/card_milk6.jpg", category: "milk" },
  ],
  fish: [
    { name: "Форель охлажденная", seller: "Ocean Foods", price: 920, rating: "4.9", reviews: 47, image: "media/card_fish1.jpg", category: "fish" },
    { name: "Филе лосося", seller: "Nordic Fish", price: 1150, rating: "4.8", reviews: 39, image: "media/card_fish2.jpg", category: "fish" },
    { name: "Судак потрошеный", seller: "Issyk-Kul Fish", price: 680, rating: "4.7", reviews: 24, image: "media/card_fish3.jpg", category: "fish" },
    { name: "Карась свежий", seller: "Local Fisher", price: 340, rating: "4.5", reviews: 19, image: "media/card_fish4.jpg", category: "fish" },
    { name: "Креветки 90/120", seller: "Sea Market", price: 780, rating: "4.6", reviews: 31, image: "media/card_fish5.jpg", category: "fish" },
    { name: "Оптовые морепродукты", seller: "USC партнёр", price: 0, rating: "4.9", reviews: 14, image: "media/card_fish6.jpg", category: "fish" },
  ],
  bread: [
    { name: "Хлеб пшеничный", seller: "Bakery 24", price: 25, rating: "4.8", reviews: 80, image: "media/card_bread1.jpg", category: "bread" },
    { name: "Лепёшка тандырная", seller: "Orient Bakery", price: 30, rating: "4.9", reviews: 67, image: "media/card_bread2.jpg", category: "bread" },
    { name: "Багет классический", seller: "French Corner", price: 45, rating: "4.7", reviews: 29, image: "media/card_bread3.jpg", category: "bread" },
    { name: "Цельнозерновой хлеб", seller: "Healthy Bake", price: 55, rating: "4.6", reviews: 22, image: "media/card_bread4.jpg", category: "bread" },
    { name: "Круассаны сливочные", seller: "Morning Cafe", price: 90, rating: "4.9", reviews: 51, image: "media/card_bread5.jpg", category: "bread" },
    { name: "Оптовые хлебобулочные", seller: "USC партнёр", price: 0, rating: "4.8", reviews: 17, image: "media/card_bread6.jpg", category: "bread" },
  ],
  fruit: [
    { name: "Яблоки красные", seller: "Green Market", price: 80, rating: "4.8", reviews: 60, image: "media/card_fruit1.jpg", category: "fruit" },
    { name: "Морковь молодая", seller: "Village Agro", price: 45, rating: "4.7", reviews: 34, image: "media/card_fruit2.jpg", category: "fruit" },
    { name: "Картофель мытый", seller: "Agro Plus", price: 38, rating: "4.6", reviews: 29, image: "media/card_fruit3.jpg", category: "fruit" },
    { name: "Огурцы тепличные", seller: "Fresh Line", price: 75, rating: "4.5", reviews: 21, image: "media/card_fruit4.jpg", category: "fruit" },
    { name: "Помидоры розовые", seller: "Sun Farm", price: 95, rating: "4.7", reviews: 32, image: "media/card_fruit5.jpg", category: "fruit" },
    { name: "Оптовые овощи и фрукты", seller: "USC партнёр", price: 0, rating: "4.9", reviews: 19, image: "media/card_fruit6.jpg", category: "fruit" },
  ],
  grain: [
    { name: "Пшеница продовольственная", seller: "Agro Export", price: 26, rating: "4.8", reviews: 40, image: "media/card_grain1.jpg", category: "grain" },
    { name: "Рис узбекский длиннозёрный", seller: "Asia Grain", price: 70, rating: "4.7", reviews: 33, image: "media/card_grain2.jpg", category: "grain" },
    { name: "Гречка ядрица", seller: "Eco Grain", price: 85, rating: "4.9", reviews: 28, image: "media/card_grain3.jpg", category: "grain" },
    { name: "Овсяные хлопья", seller: "Healthy Grain", price: 60, rating: "4.6", reviews: 25, image: "media/card_grain4.jpg", category: "grain" },
    { name: "Комбикорм", seller: "Feed Pro", price: 48, rating: "4.5", reviews: 18, image: "media/card_grain5.jpg", category: "grain" },
    { name: "Зерновые поставки", seller: "USC партнёр", price: 0, rating: "4.9", reviews: 16, image: "media/card_grain6.jpg", category: "grain" },
  ],
};

export function demoProductsFlat(): Product[] {
  const arr: Product[] = [];
  Object.values(DEMO_PRODUCTS_BY_CATEGORY).forEach((items, idxCat) => {
    items.forEach((p, idx) => {
      arr.push({
        id: `demo_${idxCat}_${idx}`,
        ...p,
      });
    });
  });
  return arr;
}
