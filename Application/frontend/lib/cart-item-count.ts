import type { CartOut } from "@/lib/cart-types";

export function cartItemCount(cart: CartOut | null): number {
  if (!cart) return 0;
  return cart.lines.reduce((sum, line) => sum + line.quantity, 0);
}