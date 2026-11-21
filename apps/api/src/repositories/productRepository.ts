import type { Product } from "@catalogue/shared";

/**
 * The seam between our application and wherever products come from.
 * Fake Store is one implementation; a database or another API can replace it
 * without changing services, routes, or the client.
 */
export interface ProductRepository {
  getAll(): Promise<Product[]>;
  getById(id: number): Promise<Product | null>;
}
