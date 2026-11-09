import type { Money } from "./types";

// Preview in integer cents, just like the backend. No floating-point multiplication.
export function estimateProfit(
  purchase: Money,
  sale: Money,
  quantity: number,
): string | null {
  if (
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    quantity > 1_000_000_000
  )
    return null;
  const cents = (value: Money) => {
    const [whole, fraction = ""] = String(value).split(".");
    return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0").slice(0, 2));
  };
  const profit = (cents(sale) - cents(purchase)) * BigInt(quantity);
  const magnitude = profit < 0n ? -profit : profit;
  return `${profit < 0n ? "-" : ""}${magnitude / 100n}.${String(magnitude % 100n).padStart(2, "0")}`;
}
