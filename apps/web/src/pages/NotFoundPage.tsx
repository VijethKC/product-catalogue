import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section className="space-y-4 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-indigo-600">
        404
      </p>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        We couldn&apos;t find that page.
      </h1>
      <Link
        to="/"
        className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
      >
        Back to catalogue
      </Link>
    </section>
  );
}
