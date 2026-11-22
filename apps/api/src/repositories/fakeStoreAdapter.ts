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
  const root = baseUrl.replace(/\/+$/, "");

  async function request(path: string): Promise<Response> {
    try {
      return await fetchImpl(`${root}${path}`, {
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
  }

  async function readBody(response: Response): Promise<string> {
    try {
      return await response.text();
    } catch {
      throw new HttpError(
        502,
        "UPSTREAM_INVALID_RESPONSE",
        "The product data source returned invalid data",
      );
    }
  }

  function parseJson(body: string): unknown {
    try {
      return JSON.parse(body);
    } catch {
      throw new HttpError(
        502,
        "UPSTREAM_INVALID_RESPONSE",
        "The product data source returned invalid data",
      );
    }
  }

  return {
    async getAll() {
      const response = await request("/products");

      if (!response.ok) {
        throw new HttpError(
          502,
          "UPSTREAM_UNAVAILABLE",
          "The product data source returned an error",
        );
      }

      const parsed = productListSchema.safeParse(
        parseJson(await readBody(response)),
      );

      if (!parsed.success) {
        throw new HttpError(
          502,
          "UPSTREAM_INVALID_RESPONSE",
          "The product data source returned invalid data",
        );
      }

      return parsed.data;
    },

    async getById(id) {
      const response = await request(`/products/${id}`);

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new HttpError(
          502,
          "UPSTREAM_UNAVAILABLE",
          "The product data source returned an error",
        );
      }

      const body = await readBody(response);

      // Fake Store answers unknown IDs with 200 and an empty body.
      if (body.trim() === "") {
        return null;
      }

      const payload = parseJson(body);

      if (payload === null) {
        return null;
      }

      const parsed = productSchema.safeParse(payload);

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
