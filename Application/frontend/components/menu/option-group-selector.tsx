import { formatVnd } from "@/lib/format";
import type { MenuItemDetail } from "@/lib/api/menu";

type Group = MenuItemDetail["option_groups"][number];

type Props = {
  group: Group;
  selectedIds: number[];
  onChange: (ids: number[]) => void;
};

export function OptionGroupSelector({ group, selectedIds, onChange }: Props) {
  const single = group.select_type === "single";

  function toggle(optionId: number) {
    if (single) {
      onChange([optionId]);
      return;
    }
    onChange(
      selectedIds.includes(optionId)
        ? selectedIds.filter((x) => x !== optionId)
        : [...selectedIds, optionId],
    );
  }

  // Single-select (size/crust) wraps as a row; multi-select (toppings) fills a grid.
  const layout = single
    ? "flex flex-wrap gap-3"
    : "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4";

  return (
    <div role={single ? "radiogroup" : "group"} aria-label={group.name} className={layout}>
      {group.options.map((o) => {
        const selected = selectedIds.includes(o.option_id);
        return (
          <button
            key={o.option_id}
            type="button"
            role={single ? "radio" : "checkbox"}
            aria-checked={selected}
            onClick={() => toggle(o.option_id)}
            className={`flex min-h-[52px] min-w-[84px] flex-col items-center justify-center gap-0.5 rounded-xl border px-4 py-2.5 text-center text-sm transition-colors ${
              selected
                ? "border-brand bg-brand-subtle font-semibold text-brand-fg"
                : "border-line bg-card text-fg hover:border-muted"
            }`}
          >
            <span>{o.name}</span>
            {o.price_delta_vnd > 0 ? (
              <span className={`text-xs ${selected ? "text-brand-fg" : "text-muted"}`}>
                +{formatVnd(o.price_delta_vnd)}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
