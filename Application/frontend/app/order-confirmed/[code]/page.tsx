import Link from "next/link";

type Props = { params: Promise<{ code: string }> };

export default async function OrderConfirmedPage({ params }: Props) {
  const { code } = await params;
  const displayCode = decodeURIComponent(code);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-card p-10 text-center">
        <div
          className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-success/15 text-success"
          aria-hidden
        >
          <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-fg">Order Confirmed!</h1>
        <p className="mt-2 text-muted">Thank you for your order. We&apos;re preparing it now.</p>

        <div className="mt-8 rounded-xl border border-brand/20 bg-brand/5 px-5 py-4">
          <p className="text-sm font-semibold text-muted">Order Number</p>
          <p className="mt-1 text-2xl font-extrabold tracking-tight text-brand tabular-nums">
            {displayCode}
          </p>
        </div>

        <div className="mt-8 text-left">
          <h2 className="text-base font-bold text-fg">What&apos;s Next?</h2>
          <ul className="mt-3 space-y-2.5 text-sm text-muted">
            <li className="flex gap-2">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" aria-hidden />
              Your order is being prepared in our kitchen
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" aria-hidden />
              Estimated ready window: about 45 minutes
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" aria-hidden />
              Track status on the order tracking page
            </li>
          </ul>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link
            href={`/track?code=${encodeURIComponent(displayCode)}`}
            className="btn-primary flex h-12 items-center justify-center text-base font-semibold"
          >
            Track Order
          </Link>
          <Link
            href="/"
            className="flex h-12 items-center justify-center rounded-full border border-line text-base font-semibold text-fg hover:bg-surface-hover"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}