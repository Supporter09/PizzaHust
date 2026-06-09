import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-2xl font-bold text-fg">Page not found</h1>
      <p className="mt-2 text-sm text-muted">The page you’re looking for doesn’t exist.</p>
      <Link href="/" className="btn-primary mt-6 inline-block px-5 py-2.5">
        Back home
      </Link>
    </div>
  );
}