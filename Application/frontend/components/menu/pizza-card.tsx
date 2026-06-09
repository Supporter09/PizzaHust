import { formatVnd } from "@/lib/format";

type Props = {
  name: string;
  basePriceVnd: number;
  isPizza: boolean;
  imageUrl: string | null;
};

export function PizzaCard({ name, basePriceVnd, isPizza, imageUrl }: Props) {
  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-card">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={name}
          loading="lazy"
          className="h-48 w-full object-cover"
        />
      ) : (
        <div className="flex h-48 w-full items-center justify-center bg-surface-active text-sm text-muted">
          No image
        </div>
      )}
      <div className="space-y-1 p-4">
        <h3 className="font-semibold text-fg">{name}</h3>
        <p className="font-bold text-brand">
          {isPizza ? "from " : ""}
          {formatVnd(basePriceVnd)}
        </p>
      </div>
    </article>
  );
}