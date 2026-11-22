import type { ReactNode } from "react";
import { ProductGrid } from "../components/ProductGrid";
import {
  EmptyState,
  ErrorState,
  ProductGridSkeleton,
} from "../components/States";
import { useFeatured } from "../hooks/useCatalogue";

export function HomePage() {
  const { data, isPending, isError, refetch } = useFeatured();

  let content: ReactNode;

  if (isPending) {
    content = <ProductGridSkeleton count={5} />;
  } else if (isError) {
    content = <ErrorState onRetry={() => void refetch()} />;
  } else if ((data?.products.length ?? 0) === 0) {
    content = <EmptyState title="No featured products yet" />;
  } else {
    content = (
      <ProductGrid products={data?.products ?? []} variant="featured" />
    );
  }

  return (
    <section aria-labelledby="featured-heading" className="space-y-6">
      <header>
        <h1
          id="featured-heading"
          className="text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          Top rated products
        </h1>
        <p className="mt-2 text-slate-600">
          Five favourites chosen by our team
        </p>
      </header>
      {content}
    </section>
  );
}
