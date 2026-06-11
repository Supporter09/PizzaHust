import { formatVnd } from "@/lib/format";
import type { ComboEligibleProduct } from "@/lib/api/combos";

type Props = {
  label: string;
  products: ComboEligibleProduct[];
  selectedProductId: number | null;
  onPick: (productId: number) => void;
};

export function SlotPicker({ label, products, selectedProductId, onPick }: Props) {
  return (
    <div role="radiogroup" aria-label={label} data-testid="slot-group" className="flex flex-wrap gap-2">
      {products.map((p) => {
        const selected = p.product_id === selectedProductId;
        return (
          <button
            key={p.product_id}
            type="button"
            role="radio"
            aria-checked={selected}
            data-testid="slot-pick"
            onClick={() => onPick(p.product_id)}
            className={`inline-flex h-11 items-center rounded-full px-4 text-sm font-medium transition-colors ${
              selected
                ? "bg-brand text-on-brand"
                : "bg-surface-active text-fg hover:bg-surface-hover"
            }`}
          >
            {p.name}
            {p.surcharge_vnd > 0 ? ` +${formatVnd(p.surcharge_vnd)}` : ""}
          </button>
        );
      })}
    </div>
  );
}