"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "@/components/auth-provider";
import {
  addCartLine,
  clearCart as clearCartApi,
  deleteCartLine,
  getCart,
  patchCartLine,
} from "@/lib/api/cart";
import { cartItemCount } from "@/lib/cart-item-count";
import type { AddLinePayload, CartOut } from "@/lib/cart-types";

type CartContextValue = {
  cart: CartOut | null;
  loading: boolean;
  itemCount: number;
  addLine: (payload: AddLinePayload) => Promise<void>;
  updateLine: (lineId: number, patch: { quantity?: number; note?: string | null }) => Promise<void>;
  removeLine: (lineId: number) => Promise<void>;
  clear: () => Promise<void>;
  refresh: () => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartOut | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const next = await getCart();
      setCart(next);
    } catch {
      setCart(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh, user?.user_id]);

  const addLine = useCallback(async (payload: AddLinePayload) => {
    const next = await addCartLine(payload);
    setCart(next);
  }, []);

  const updateLine = useCallback(
    async (lineId: number, patch: { quantity?: number; note?: string | null }) => {
      const next = await patchCartLine(lineId, patch);
      setCart(next);
    },
    [],
  );

  const removeLine = useCallback(async (lineId: number) => {
    const next = await deleteCartLine(lineId);
    setCart(next);
  }, []);

  const clear = useCallback(async () => {
    const next = await clearCartApi();
    setCart(next);
  }, []);

  const itemCount = useMemo(() => cartItemCount(cart), [cart]);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      loading,
      itemCount,
      addLine,
      updateLine,
      removeLine,
      clear,
      refresh,
    }),
    [cart, loading, itemCount, addLine, updateLine, removeLine, clear, refresh],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used inside <CartProvider>");
  }
  return context;
}