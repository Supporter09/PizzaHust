import type { ReactNode } from "react";

/**
 * Stroke icons for the landing page, matching the codebase's hand-rolled
 * convention (viewBox 24, strokeWidth 1.75) rather than pulling in an icon
 * dependency. Decorative; hidden from assistive tech.
 */
type IconProps = { className?: string };

function Glyph({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-5 w-5"}
    >
      {children}
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Glyph>
  );
}

export function TruckIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M14 18V6a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h2" />
      <path d="M14 9h4l4 4v4a1 1 0 0 1-1 1h-1" />
      <circle cx="7.5" cy="18.5" r="2.5" />
      <circle cx="17.5" cy="18.5" r="2.5" />
    </Glyph>
  );
}

export function PinIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </Glyph>
  );
}

export function WalletIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M3 7a2 2 0 0 1 2-2h12a1 1 0 0 1 1 1v2" />
      <path d="M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3" />
      <path d="M21 11h-5a2 2 0 0 0 0 4h5a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1Z" />
    </Glyph>
  );
}

export function FlameIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 3c0 3.5-4.5 4.8-4.5 8.5a4.5 4.5 0 0 0 9 0c0-1.7-1-2.8-1-4 1.2.8 2 2 2 3.8a6.5 6.5 0 1 1-13 0C3.5 7.8 9 6 12 3Z" />
    </Glyph>
  );
}
