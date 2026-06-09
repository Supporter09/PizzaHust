import { formatVnd } from "@/lib/format";
import type { MenuItemDetail } from "@/lib/api/menu";

type Topping = MenuItemDetail["toppings"][number];

type Props = {
  toppings: Topping[];
  selectedIds: number[];
  onToggle: (toppingId: number) => void;
};

export function ToppingSelector({ toppings, selectedIds, onToggle }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {toppings.map((t) => {
        const selected = selectedIds.includes(t.topping_id);
        return (
          <button
            key={t.topping_id}
            type="button"
            role="checkbox"
            aria-checked={selected}
            onClick={() => onToggle(t.topping_id)}
            className={`inline-flex min-h-11 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
              selected
                ? "border-brand bg-brand-subtle text-fg"
                : "border-line bg-card text-fg hover:bg-surface-hover"
            }`}
          >
            <span>{t.name}</span>
            <span className="text-muted">+{formatVnd(t.price_vnd)}</span>
          </button>
        );
      })}
    </div>
  );
}
