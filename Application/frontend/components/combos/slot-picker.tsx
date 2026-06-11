import { SlotPickCard } from "@/components/combos/slot-pick-card";
import type { ComboEligibleProduct } from "@/lib/api/combos";

type Props = {
  label: string;
  products: ComboEligibleProduct[];
  selectedProductId: number | null;
  onPick: (productId: number) => void;
};

export function SlotPicker({ label, products, selectedProductId, onPick }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      data-testid="slot-group"
      className="grid gap-2.5 sm:grid-cols-2"
    >
      {products.map((p) => (
        <SlotPickCard
          key={p.product_id}
          product={p}
          selected={p.product_id === selectedProductId}
          onPick={() => onPick(p.product_id)}
        />
      ))}
    </div>
  );
}
