type Props = {
  value: number;
  onChange: (next: number) => void;
  max?: number;
};

// 99 mirrors the server cap on cart-line quantity (POST /api/cart/lines, PATCH).
export function QuantityStepper({ value, onChange, max = 99 }: Props) {
  return (
    <div className="inline-flex items-center gap-3">
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-active text-lg text-fg hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        −
      </button>
      <span aria-live="polite" className="min-w-8 text-center text-lg font-semibold text-fg">
        {value}
      </span>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-active text-lg text-fg hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}
