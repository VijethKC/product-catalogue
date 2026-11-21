import type {
  Product,
  ProductListResponse,
  ProductQuery,
} from "@catalogue/shared";
import type { ProductRepository } from "../repositories/productRepository";

export interface ProductService {
  list(query: ProductQuery): Promise<ProductListResponse>;
}

export function createProductService(
  repository: ProductRepository,
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
