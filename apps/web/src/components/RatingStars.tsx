import type { Rating } from "@catalogue/shared";

interface RatingStarsProps {
  rating: Rating;
}

export function RatingStars({ rating }: RatingStarsProps) {
  const filled = Math.round(rating.rate);

  return (
    <span
      role="img"
      aria-label={`${rating.rate} out of 5 from ${rating.count} reviews`}
      className="inline-flex items-center gap-1 text-sm text-slate-600"
    >
      <span aria-hidden="true" className="text-amber-500">
        {"★".repeat(filled)}
        {"☆".repeat(Math.max(0, 5 - filled))}
      </span>
      <span aria-hidden="true">
        {rating.rate.toFixed(1)} ({rating.count})
      </span>
    </span>
  );
}
