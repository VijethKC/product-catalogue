import type { Product } from "@catalogue/shared";
import type { ProductRepository } from "./productRepository";

/**
 * Deterministic in-memory repository for tests and offline development.
 * Returns copies so callers cannot mutate the fixtures.
 */
export function createFixtureAdapter(
  products: readonly Product[],
): ProductRepository {
  return {
    async getAll() {
      return [...products];
    },

    async getById(id) {
      return products.find((product) => product.id === id) ?? null;
    },
  };
}
