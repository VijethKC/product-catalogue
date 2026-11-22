import type { Product } from "@catalogue/shared";
import { Link } from "react-router-dom";
import { Price } from "./Price";
import { RatingStars } from "./RatingStars";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <article className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <Link
        to={`/products/${product.id}`}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
      >
        <div className="aspect-square border-b border-slate-100 bg-white p-4">
          <img
            src={product.image}
            alt={product.title}
            loading="lazy"
            className="h-full w-full object-contain"
          />
        </div>
        <div className="space-y-2 p-4">
          <h3 className="line-clamp-2 min-h-12 text-base font-medium text-slate-900">
            {product.title}
          </h3>
          <RatingStars rating={product.rating} />
          <Price value={product.price} />
        </div>
      </Link>
    </article>
  );
}
