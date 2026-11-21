import type { Product } from "@catalogue/shared";
import type { ProductRepository } from "./productRepository";

/**
 * Deterministic in-memory repository for tests and offline development.
 * Returns a copy so callers cannot mutate the fixture.
 */
export function createFixtureAdapter(
  products: readonly Product[],
): ProductRepository {
  return {
    async getAll() {
      return [...products];
    },
  };
}
