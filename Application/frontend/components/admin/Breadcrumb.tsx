import Link from "next/link";

export interface Crumb {
  label: string;
  href?: string;
}

/** Admin page breadcrumb. The last crumb is rendered as the current page. */
export default function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${item.href ?? i}`} className="flex items-center gap-1.5">
              {item.href && !last ? (
                <Link href={item.href} className="hover:text-brand-fg">
                  {item.label}
                </Link>
              ) : (
                <span
                  className={last ? "font-medium text-fg" : undefined}
                  aria-current={last ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
              {!last && (
                <span className="text-muted" aria-hidden>
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
