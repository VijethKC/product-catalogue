import { Link, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { EnquiryForm } from "../components/EnquiryForm";
import { Price } from "../components/Price";
import { RatingStars } from "../components/RatingStars";
import { EmptyState, ErrorState } from "../components/States";
import { useProduct } from "../hooks/useCatalogue";

function ProductNotFound() {
  return (
    <EmptyState title="Product not found">
      <Link to="/" className="font-medium text-indigo-600 hover:underline">
        Back to catalogue
      </Link>
    </EmptyState>
  );
}

function DetailSkeleton() {
  return (
    <div>
      <p role="status" className="sr-only">
        Loading product…
      </p>
      <div
        aria-hidden="true"
        className="grid animate-pulse gap-8 motion-reduce:animate-none lg:grid-cols-2"
      >
        <div className="aspect-square rounded-xl border border-slate-200 bg-white" />
        <div className="space-y-4">
          <div className="h-4 w-24 rounded bg-slate-200" />
          <div className="h-8 w-3/4 rounded bg-slate-200" />
          <div className="h-4 w-40 rounded bg-slate-200" />
          <div className="h-6 w-24 rounded bg-slate-200" />
          <div className="h-24 rounded bg-slate-200" />
        </div>
      </div>
    </div>
  );
}

export function ProductDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const productId = Number(id);
  const isValid = Number.isInteger(productId) && productId > 0;
  const { data, isPending, isError, error, refetch } = useProduct(productId);

  if (!isValid) {
    return <ProductNotFound />;
  }

  if (isPending) {
    return <DetailSkeleton />;
  }

  if (isError) {
    if (error instanceof ApiError && error.status === 404) {
      return <ProductNotFound />;
    }

    return <ErrorState onRetry={() => void refetch()} />;
  }

  if (data === undefined) {
    return <ProductNotFound />;
  }

  return (
    <div className="space-y-6">
      <Link
        to="/"
        className="text-sm font-medium text-indigo-600 hover:underline"
      >
        ← Back to catalogue
      </Link>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="aspect-square rounded-xl border border-slate-200 bg-white p-6">
          <img
            src={data.image}
            alt={data.title}
            className="h-full w-full object-contain"
          />
        </div>

        <div className="space-y-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            {data.category}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {data.title}
          </h1>
          <RatingStars rating={data.rating} />
          <Price value={data.price} />
          <p className="text-slate-600">{data.description}</p>

          <EnquiryForm productId={data.id} />
        </div>
      </div>
    </div>
  );
}
