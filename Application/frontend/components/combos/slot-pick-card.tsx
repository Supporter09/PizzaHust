import { imageSrc } from "@/lib/api/asset-url";
import { formatVnd } from "@/lib/format";
import type { ComboEligibleProduct } from "@/lib/api/combos";

type Props = {
  product: ComboEligibleProduct;
  selected: boolean;
  onPick: () => void;
};

export function SlotPickCard({ product, selected, onPick }: Props) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      data-testid="slot-pick"
      onClick={onPick}
      className={`flex min-h-16 w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition-colors ${
        selected ? "border-brand bg-brand-subtle/30" : "border-line bg-card hover:border-brand/50"
      }`}
    >
      {product.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageSrc(product.image_url)}
          alt=""
          className="h-10 w-10 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <span aria-hidden="true" className="h-10 w-10 shrink-0 rounded-lg bg-surface-active" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-fg">{product.name}</span>
        <span className="block text-xs text-muted">
          {product.surcharge_vnd > 0 ? `+${formatVnd(product.surcharge_vnd)}` : "Included"}
        </span>
      </span>
      <span
        aria-hidden="true"
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
          selected ? "border-brand" : "border-line"
        }`}
      >
        {selected ? <span className="h-2.5 w-2.5 rounded-full bg-brand" /> : null}
      </span>
    </button>
  );
}
