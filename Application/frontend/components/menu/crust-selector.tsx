import type { MenuItemDetail } from "@/lib/api/menu";

type Crust = MenuItemDetail["crusts"][number];

type Props = {
  crusts: Crust[];
  selectedId: number | null;
  onSelect: (crustId: number) => void;
};

export function CrustSelector({ crusts, selectedId, onSelect }: Props) {
  return (
    <div role="radiogroup" aria-label="Choose crust" className="flex flex-wrap gap-2">
      {crusts.map((c) => {
        const selected = c.crust_id === selectedId;
        return (
          <button
            key={c.crust_id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onSelect(c.crust_id)}
            className={`inline-flex h-11 items-center rounded-full px-4 text-sm font-medium capitalize transition-colors ${
              selected
                ? "bg-brand text-on-brand"
                : "bg-surface-active text-fg hover:bg-surface-hover"
            }`}
          >
            {c.name}
          </button>
        );
      })}
    </div>
  );
}
