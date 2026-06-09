import type { MenuCategory } from "@/lib/api/menu";

type Props = {
  categories: MenuCategory[];
  active: number | null;
  onSelect: (categoryId: number | null) => void;
};

function chipClass(selected: boolean): string {
  return `inline-flex h-11 items-center rounded-full px-4 text-sm font-medium transition-colors ${
    selected
      ? "bg-brand text-on-brand"
      : "bg-surface-active text-fg hover:bg-surface-hover"
  }`;
}

export function CategoryFilter({ categories, active, onSelect }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        aria-pressed={active === null}
        className={chipClass(active === null)}
        onClick={() => onSelect(null)}
      >
        All
      </button>
      {categories.map((c) => (
        <button
          key={c.category_id}
          type="button"
          aria-pressed={active === c.category_id}
          className={chipClass(active === c.category_id)}
          onClick={() => onSelect(c.category_id)}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}