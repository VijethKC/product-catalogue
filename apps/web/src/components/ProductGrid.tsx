import type { Product } from "@catalogue/shared";
import { ProductCard } from "./ProductCard";

interface ProductGridProps {
  products: Product[];
  variant?: "default" | "featured";
}

export function ProductGrid({ products, variant = "default" }: ProductGridProps) {
  const columns =
    variant === "featured"
      ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      : "sm:grid-cols-2 lg:grid-cols-3";

  return (
    <div className={`grid grid-cols-1 gap-4 sm:gap-6 ${columns}`}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
