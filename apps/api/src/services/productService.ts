import type {
  CategoryProducts,
  Product,
  ProductListResponse,
  ProductQuery,
} from "@catalogue/shared";
import type { ProductRepository } from "../repositories/productRepository";

export interface ProductServiceOptions {
  /** Curated "top rated" product IDs, in display order. */
  featuredProductIds: readonly number[];
  /** How many top-rated products a category page shows before the rest. */
  featuredPerCategory: number;
}

export interface ProductService {
  list(query: ProductQuery): Promise<ProductListResponse>;
  getFeatured(): Promise<ProductListResponse>;
  getById(id: number): Promise<Product | null>;
  listCategories(): Promise<string[]>;
  getCategoryProducts(category: string): Promise<CategoryProducts | null>;
}

export function createProductService(
  repository: ProductRepository,
  { featuredProductIds, featuredPerCategory }: ProductServiceOptions,
): ProductService {
  return {
    async list(query) {
      const products = await repository.getAll();
      const matches = products.filter((product) => matchesQuery(product, query));
      const limited =
        query.limit === undefined ? matches : matches.slice(0, query.limit);

      return {
        products: limited,
        // Total reflects all matches before limit so the client can paginate.
        total: matches.length,
      };
    },

    async getFeatured() {
      const products = await repository.getAll();
      const byId = new Map(products.map((product) => [product.id, product]));
      const seen = new Set<number>();
      const featured: Product[] = [];
      const missing: number[] = [];

      for (const id of featuredProductIds) {
        if (seen.has(id)) {
          continue;
        }

        seen.add(id);
        const product = byId.get(id);

        if (product === undefined) {
          missing.push(id);
          continue;
        }

        featured.push(product);
      }

      if (missing.length > 0) {
        console.warn(`Featured product IDs not found upstream: ${missing.join(", ")}`);
      }

      return { products: featured, total: featured.length };
    },

    async getById(id) {
      return repository.getById(id);
    },

    async listCategories() {
      const products = await repository.getAll();
      const categories = new Set(products.map((product) => product.category));

      return [...categories].sort((a, b) => a.localeCompare(b));
    },

    async getCategoryProducts(category) {
      const products = await repository.getAll();
      const matches = products.filter(
        (product) => product.category.toLowerCase() === category.toLowerCase(),
      );

      if (matches.length === 0) {
        return null;
      }

      const sorted = [...matches].sort(byRatingThenId);
      const first = sorted[0];

      if (first === undefined) {
        return null;
      }

      return {
        category: first.category,
        topRated: sorted.slice(0, featuredPerCategory),
        additional: sorted.slice(featuredPerCategory),
      };
    },
  };
}

function matchesQuery(product: Product, query: ProductQuery): boolean {
  if (
    query.category !== undefined &&
    product.category.toLowerCase() !== query.category.toLowerCase()
  ) {
    return false;
  }

  if (query.q !== undefined) {
    const needle = query.q.toLowerCase();
    const haystack =
      `${product.title}\n${product.description}\n${product.category}`.toLowerCase();

    if (!haystack.includes(needle)) {
      return false;
    }
  }

  return true;
}

/** Highest rating first, then most reviews, then lowest id for determinism. */
function byRatingThenId(a: Product, b: Product): number {
  return (
    b.rating.rate - a.rating.rate ||
    b.rating.count - a.rating.count ||
    a.id - b.id
  );
}
