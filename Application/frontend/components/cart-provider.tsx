"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "pizzahust_cart_v1";

export interface CartLine {
  /** Stable client-side id so duplicate configurations remain separate rows. */
  uid: string;
  kind: "item" | "combo";
  item_id: number | null;
  combo_id: number | null;
  name: string;
  option_ids: number[];
  /** Human-readable selected options, e.g. ["Size: M", "Beef"]. Display only. */
  option_labels: string[];
  /** Best-effort unit price for optimistic display; the server quote is authoritative. */
  unit_price_vnd: number;
  quantity: number;
  notes?: string;
}

interface CartContextValue {
  lines: CartLine[];
  count: number;
  estimatedSubtotal: number;
  addLine: (line: Omit<CartLine, "uid">) => void;
  setQuantity: (uid: string, quantity: number) => void;
  removeLine: (uid: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function loadInitial(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CartLine[]) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);

  // Hydrate after mount to avoid an SSR/client markup mismatch.
  useEffect(() => {
    const handle = window.setTimeout(() => setLines(loadInitial()), 0);
    return () => window.clearTimeout(handle);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines]);

  const addLine = useCallback((line: Omit<CartLine, "uid">) => {
    setLines((prev) => [
      ...prev,
      { ...line, uid: globalThis.crypto?.randomUUID?.() ?? String(Date.now() + Math.random()) },
    ]);
  }, []);

  const setQuantity = useCallback((uid: string, quantity: number) => {
    setLines((prev) =>
      prev
        .map((l) => (l.uid === uid ? { ...l, quantity: Math.max(0, quantity) } : l))
        .filter((l) => l.quantity > 0),
    );
  }, []);

  const removeLine = useCallback((uid: string) => {
    setLines((prev) => prev.filter((l) => l.uid !== uid));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(() => {
    const count = lines.reduce((sum, l) => sum + l.quantity, 0);
    const estimatedSubtotal = lines.reduce((sum, l) => sum + l.unit_price_vnd * l.quantity, 0);
    return { lines, count, estimatedSubtotal, addLine, setQuantity, removeLine, clear };
  }, [lines, addLine, setQuantity, removeLine, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used inside <CartProvider>");
  }
  return ctx;
}
