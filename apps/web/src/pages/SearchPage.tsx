import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { ProductGrid } from "../components/ProductGrid";
import {
  EmptyState,
  ErrorState,
  ProductGridSkeleton,
} from "../components/States";
import { useProducts } from "../hooks/useCatalogue";

export function SearchPage() {
  const [params] = useSearchParams();
  const query = (params.get("q") ?? "").trim();
  const enabled = query.length >= 2;
  const { data, isPending, isError, refetch } = useProducts({ q: query }, enabled);

  if (!enabled) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Search the catalogue
        </h1>
        <p className="text-slate-600">
          Enter at least 2 characters in the search box to find products.
        </p>
      </section>
    );
  }

  let content: ReactNode;

  if (isPending) {
    content = <ProductGridSkeleton />;
  } else if (isError) {
    content = <ErrorState onRetry={() => void refetch()} />;
  } else if ((data?.products.length ?? 0) === 0) {
    content = (
      <EmptyState title={`No products match "${query}"`}>
        Try a different search term.
      </EmptyState>
    );
  } else {
    content = <ProductGrid products={data?.products ?? []} />;
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Search results for &ldquo;{query}&rdquo;
        </h1>
        {data !== undefined && (
          <p className="mt-1 text-sm text-slate-600">
            {data.total} {data.total === 1 ? "product" : "products"}
          </p>
        )}
      </header>
      {content}
    </section>
  );
}
