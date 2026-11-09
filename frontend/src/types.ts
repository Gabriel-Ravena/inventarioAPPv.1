export type Money = number | string;
export interface Product {
  id: number;
  code: string;
  name: string;
  category_id: number | null;
  category: string;
  description: string;
  purchase_price: Money;
  sale_price: Money;
  stock: number;
  minimum_stock: number;
  created_at: string;
  updated_at: string;
  status: "normal" | "low" | "out";
  price_difference: Money;
  gross_margin: Money;
  purchase_value: Money;
  sale_value: Money;
}
export interface Category {
  id: number;
  name: string;
}
export interface Movement {
  id: number;
  product_id: number;
  product_code: string;
  product_name: string;
  type: "opening" | "in" | "out" | "adjustment";
  quantity: number;
  delta: number;
  stock_before: number;
  stock_after: number;
  reference_cost: Money;
  reference_sale_price: Money | null;
  estimated_profit: Money | null;
  created_at: string;
  note: string;
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
export interface Day {
  date: string;
  incoming: number;
  outgoing: number;
}
export interface Dashboard {
  product_count: number;
  units: number;
  low_count: number;
  out_count: number;
  purchase_value: Money;
  sale_value: Money;
  today_incoming: number;
  today_outgoing: number;
  today_estimated_profit: Money;
  today_unpriced_outgoing_count: number;
  chart: Day[];
  replenish: Product[];
  recent: Movement[];
}
export interface Group {
  product_id: number;
  code: string;
  name: string;
  incoming: number;
  outgoing: number;
  adjustment_net: number;
  opening: number;
  incoming_value: Money;
  outgoing_value: Money;
  estimated_profit: Money;
  unpriced_outgoing_count: number;
}
export interface Report {
  incoming: number;
  outgoing: number;
  net: number;
  adjustment_net: number;
  opening: number;
  incoming_value: Money;
  outgoing_value: Money;
  opening_value: Money;
  adjustment_value: Money;
  estimated_profit: Money;
  unpriced_outgoing_count: number;
  start: string;
  end: string;
  movement_count: number;
  products: Group[];
  daily: Day[];
  top_incoming: Group[];
  top_outgoing: Group[];
}
export interface Settings {
  shop_name: string;
  week_start: number;
  timezone: string;
}
export interface Backup {
  name: string;
  size: number;
  created_at: string;
}
export interface PriceRow {
  id: number;
  code: string;
  name: string;
  old_purchase: Money;
  new_purchase: Money;
  old_sale: Money;
  new_sale: Money;
}
export interface PricePreview {
  rows: PriceRow[];
  preview_token: string;
  count: number;
}
export interface PriceHistory {
  id: number;
  product_code: string;
  product_name: string;
  old_purchase: Money;
  new_purchase: Money;
  old_sale: Money;
  new_sale: Money;
  created_at: string;
  reason: string;
}
export type View =
  | "home"
  | "inventory"
  | "add"
  | "stock"
  | "replenish"
  | "reports"
  | "prices"
  | "settings";
