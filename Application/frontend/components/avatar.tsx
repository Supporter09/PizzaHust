import { resolveImageUrl } from "@/lib/image-url";

export function Avatar({
  url,
  name,
  className = "h-[72px] w-[72px]",
}: {
  url: string | null;
  name: string;
  className?: string;
}) {
  if (url) {
    return (
      <img
        src={resolveImageUrl(url)}
        alt={name}
        className={`${className} flex-none rounded-full object-cover`}
      />
    );
  }
  return (
    <span
      data-testid="avatar-fallback"
      className={`${className} flex flex-none items-center justify-center rounded-full bg-brand-subtle text-brand-fg`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-1/2 w-1/2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </span>
  );
}