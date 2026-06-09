import { formatVnd } from "@/lib/format";
import type { MenuItemDetail } from "@/lib/api/menu";

type Size = MenuItemDetail["sizes"][number];

type Props = {
  sizes: Size[];
  selectedId: number | null;
  onSelect: (sizeId: number) => void;
};

export function SizeSelector({ sizes, selectedId, onSelect }: Props) {
  return (
    <div role="radiogroup" aria-label="Select size" className="flex flex-wrap gap-2">
      {sizes.map((s) => {
        const selected = s.size_id === selectedId;
        return (
          <button
            key={s.size_id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onSelect(s.size_id)}
            className={`inline-flex h-11 items-center rounded-full px-4 text-sm font-medium transition-colors ${
              selected
                ? "bg-brand text-on-brand"
                : "bg-surface-active text-fg hover:bg-surface-hover"
            }`}
          >
            {s.name}
            {s.price_modifier_vnd > 0 ? ` +${formatVnd(s.price_modifier_vnd)}` : ""}
          </button>
        );
      })}
    </div>
  );
}
