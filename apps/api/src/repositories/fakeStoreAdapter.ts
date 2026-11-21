import { productSchema } from "@catalogue/shared";
import { z } from "zod";
import { HttpError } from "../errors";
import type { ProductRepository } from "./productRepository";

const productListSchema = z.array(productSchema);

export interface FakeStoreAdapterOptions {
  baseUrl: string;
  timeoutMs?: number;
  /** Injected in tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

/**
 * Fetches products from Fake Store and normalizes them to the shared contract.
 * Upstream failures are translated into a stable 502 envelope so callers never
 * see raw provider errors.
 */
export function createFakeStoreAdapter({
  baseUrl,
  timeoutMs = 5_000,
  fetchImpl = globalThis.fetch,
}: FakeStoreAdapterOptions): ProductRepository {
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/products`;

  return {
    async getAll() {
      let response: Response;

      try {
        response = await fetchImpl(endpoint, {
          headers: { accept: "application/json" },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        throw new HttpError(
          502,
          "UPSTREAM_UNAVAILABLE",
          "The product data source is unavailable",
        );
      }

      if (!response.ok) {
        throw new HttpError(
          502,
          "UPSTREAM_UNAVAILABLE",
          "The product data source returned an error",
        );
      }

      let payload: unknown;

      try {
        payload = await response.json();
      } catch {
        throw new HttpError(
          502,
          "UPSTREAM_INVALID_RESPONSE",
          "The product data source returned invalid data",
        );
      }

      const parsed = productListSchema.safeParse(payload);

      if (!parsed.success) {
        throw new HttpError(
          502,
          "UPSTREAM_INVALID_RESPONSE",
          "The product data source returned invalid data",
        );
      }

      return parsed.data;
    },
  };
}
