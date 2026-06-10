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

  return (
    <div
      role={single ? "radiogroup" : "group"}
      aria-label={group.name}
      className="flex flex-wrap gap-2"
    >
      {group.options.map((o) => {
        const selected = selectedIds.includes(o.option_id);
        return (
          <button
            key={o.option_id}
            type="button"
            role={single ? "radio" : "checkbox"}
            aria-checked={selected}
            onClick={() => toggle(o.option_id)}
            className={`inline-flex h-11 items-center rounded-full px-4 text-sm font-medium transition-colors ${
              selected
                ? "bg-brand text-on-brand"
                : "bg-surface-active text-fg hover:bg-surface-hover"
            }`}
          >
            {o.name}
            {o.price_delta_vnd > 0 ? ` +${formatVnd(o.price_delta_vnd)}` : ""}
          </button>
        );
      })}
    </div>
  );
}
