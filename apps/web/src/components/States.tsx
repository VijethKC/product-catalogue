import type { ReactNode } from "react";

export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div>
      <p role="status" className="sr-only">
        Loading products…
      </p>
      <div
        aria-hidden="true"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3"
      >
        {Array.from({ length: count }, (_, index) => (
          <div
            key={index}
            className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white motion-reduce:animate-none"
          />
        ))}
      </div>
    </div>
  );
}

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  message = "Something went wrong",
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 p-6 text-center"
    >
      <p className="font-medium text-red-800">{message}</p>
      {onRetry !== undefined && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
        >
          Try again
        </button>
      )}
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  children?: ReactNode;
}

export function EmptyState({ title, children }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <p className="text-base font-medium text-slate-900">{title}</p>
      {children !== undefined && (
        <div className="mt-2 text-sm text-slate-600">{children}</div>
      )}
    </div>
  );
}
