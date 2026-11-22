import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { ProductGrid } from "../components/ProductGrid";
import {
  EmptyState,
  ErrorState,
  ProductGridSkeleton,
} from "../components/States";
import { useCategoryProducts } from "../hooks/useCatalogue";

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function CategoryPage() {
  const { category = "" } = useParams<{ category: string }>();
  const decoded = decodeURIComponent(category);
  const { data, isPending, isError, error, refetch } =
    useCategoryProducts(decoded);

  let content: ReactNode;

  if (isPending) {
    content = <ProductGridSkeleton />;
  } else if (isError) {
    content =
      error instanceof ApiError && error.status === 404 ? (
        <EmptyState title="Category not found">
          <Link to="/" className="font-medium text-indigo-600 hover:underline">
            Back to catalogue
          </Link>
        </EmptyState>
      ) : (
        <ErrorState onRetry={() => void refetch()} />
      );
  } else if (
    data !== undefined &&
    data.topRated.length + data.additional.length === 0
  ) {
    content = <EmptyState title="No products in this category yet" />;
  } else {
    content = (
      <div className="space-y-8">
        {data !== undefined && data.topRated.length > 0 && (
          <section aria-labelledby="top-rated-heading">
            <h2
              id="top-rated-heading"
              className="mb-4 text-lg font-semibold text-slate-900"
            >
              Top rated
            </h2>
            <ProductGrid products={data.topRated} />
          </section>
        )}
        {data !== undefined && data.additional.length > 0 && (
          <section aria-labelledby="additional-heading">
            <h2
              id="additional-heading"
              className="mb-4 text-lg font-semibold text-slate-900"
            >
              More in {capitalize(data.category)}
            </h2>
            <ProductGrid products={data.additional} />
          </section>
        )}
      </div>
    );
  }

  const heading = data?.category ?? decoded;

  return (
    <section className="space-y-6">
      <div>
        <Link
          to="/"
          className="text-sm font-medium text-indigo-600 hover:underline"
        >
          ← All categories
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          {capitalize(heading)}
        </h1>
        {data !== undefined && (
          <p className="mt-1 text-sm text-slate-600">
            {data.topRated.length + data.additional.length} products
          </p>
        )}
      </div>
      {content}
    </section>
  );
}
