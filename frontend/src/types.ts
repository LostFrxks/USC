export type Screen =
  | "home"
  | "search"
  | "cart"
  | "analytics"
  | "ai"
  | "profile"
  | "publications"
  | "profile-edit"
  | "orders"
  | "deliveries"
  | "notifications"
  | "about"
  | "help"
  | "faq";

export type Category = "meat" | "milk" | "fish" | "bread" | "fruit" | "grain";

export type Product = {
  id: string;
  name: string;
  seller: string;
  description?: string;
  shelf_life_days?: number | null;
  storage_condition?: string | null;
  origin_country?: string | null;
  brand?: string | null;
  manufacturer?: string | null;
  package_type?: string | null;
  net_weight_grams?: number | null;
  allergens?: string | null;
  certifications?: string | null;
  lead_time_days?: number | null;
  price: number;
  rating?: string | null;
  reviews?: number | null;
  image: string; // "media/xxx.jpg"
  category: Category;

  // поля из API (нужны для заказов/фильтрации)
  supplier_company_id?: number;
  category_id?: number | null;
};

export type CartItem = {
  product: Product;
  qty: number;
};

export type DeliveryMethod = "YANDEX" | "SUPPLIER_COURIER";

export type CreateOrderPayload = {
  items: Array<{ product_id: string; qty: number }>;
  delivery_method: DeliveryMethod;
  comment?: string;
};
