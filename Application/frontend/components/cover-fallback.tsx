/**
 * Branded striped placeholder for items/combos with no image, replacing the
 * flat-grey "No image" box. Decorative — hidden from assistive tech.
 */
export function CoverFallback({
  label,
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`cover-stripe flex items-center justify-center ${className ?? ""}`}
    >
      {label ? (
        <span className="px-3 text-center text-xs font-medium uppercase tracking-widest text-brand-fg/55">
          {label}
        </span>
      ) : null}
    </div>
  );
}
