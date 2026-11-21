import nock from "nock";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Product } from "@catalogue/shared";
import { createFakeStoreAdapter } from "../src/repositories/fakeStoreAdapter";
import { products } from "./fixtures/products";

const baseUrl = "https://fake-store.test";

function requireProduct(id: number): Product {
  const product = products.find((item) => item.id === id);

  if (product === undefined) {
    throw new Error(`Missing fixture product ${id}`);
  }

  return product;
}

afterEach(() => {
  nock.cleanAll();
});

describe("fakeStoreAdapter.getAll", () => {
  it("returns products normalized to the shared contract", async () => {
    nock(baseUrl).get("/products").reply(200, products);

    const adapter = createFakeStoreAdapter({ baseUrl });

    await expect(adapter.getAll()).resolves.toEqual(products);
  });

  it("normalizes a base URL with a trailing slash", async () => {
    nock(baseUrl).get("/products").reply(200, products);

    const adapter = createFakeStoreAdapter({ baseUrl: `${baseUrl}/` });

    await expect(adapter.getAll()).resolves.toHaveLength(products.length);
  });

  it("maps an upstream error status to 502", async () => {
    nock(baseUrl).get("/products").reply(500);

    const adapter = createFakeStoreAdapter({ baseUrl });

    await expect(adapter.getAll()).rejects.toMatchObject({
      status: 502,
      code: "UPSTREAM_UNAVAILABLE",
    });
  });

  it("maps malformed JSON to 502", async () => {
    nock(baseUrl)
      .get("/products")
      .reply(200, "not-json", { "content-type": "application/json" });

    const adapter = createFakeStoreAdapter({ baseUrl });

    await expect(adapter.getAll()).rejects.toMatchObject({
      status: 502,
      code: "UPSTREAM_INVALID_RESPONSE",
    });
  });

  it("maps a payload that violates the contract to 502", async () => {
    nock(baseUrl).get("/products").reply(200, [{ id: "not-a-number" }]);

    const adapter = createFakeStoreAdapter({ baseUrl });

    await expect(adapter.getAll()).rejects.toMatchObject({
      status: 502,
      code: "UPSTREAM_INVALID_RESPONSE",
    });
  });

  it("maps a network failure to 502", async () => {
    nock(baseUrl).get("/products").replyWithError("connection refused");

    const adapter = createFakeStoreAdapter({ baseUrl });

    await expect(adapter.getAll()).rejects.toMatchObject({
      status: 502,
      code: "UPSTREAM_UNAVAILABLE",
    });
  });

  it("maps a timeout abort to 502", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new DOMException(
        "The operation was aborted due to timeout",
        "TimeoutError",
      );
    });

    const adapter = createFakeStoreAdapter({
      baseUrl,
      timeoutMs: 20,
      fetchImpl: fetchImpl as typeof fetch,
    });

    await expect(adapter.getAll()).rejects.toMatchObject({
      status: 502,
      code: "UPSTREAM_UNAVAILABLE",
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      `${baseUrl}/products`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});

describe("fakeStoreAdapter.getById", () => {
  it("returns a single product", async () => {
    const bracelet = requireProduct(3);
    nock(baseUrl).get("/products/3").reply(200, bracelet);

    const adapter = createFakeStoreAdapter({ baseUrl });

    await expect(adapter.getById(3)).resolves.toEqual(bracelet);
  });

  it("returns null when the upstream reports 404", async () => {
    nock(baseUrl).get("/products/99").reply(404);

    const adapter = createFakeStoreAdapter({ baseUrl });

    await expect(adapter.getById(99)).resolves.toBeNull();
  });

  it("returns null when the upstream answers 200 with an empty body", async () => {
    // Fake Store does this for unknown IDs instead of returning 404.
    nock(baseUrl).get("/products/99").reply(200);

    const adapter = createFakeStoreAdapter({ baseUrl });

    await expect(adapter.getById(99)).resolves.toBeNull();
  });

  it("returns null when the upstream answers 200 with null", async () => {
    nock(baseUrl).get("/products/99").reply(200, null);

    const adapter = createFakeStoreAdapter({ baseUrl });

    await expect(adapter.getById(99)).resolves.toBeNull();
  });

  it("maps an upstream error status to 502", async () => {
    nock(baseUrl).get("/products/3").reply(500);

    const adapter = createFakeStoreAdapter({ baseUrl });

    await expect(adapter.getById(3)).rejects.toMatchObject({
      status: 502,
      code: "UPSTREAM_UNAVAILABLE",
    });
  });

  it("maps a payload that violates the contract to 502", async () => {
    nock(baseUrl).get("/products/3").reply(200, { id: "not-a-number" });

    const adapter = createFakeStoreAdapter({ baseUrl });

    await expect(adapter.getById(3)).rejects.toMatchObject({
      status: 502,
      code: "UPSTREAM_INVALID_RESPONSE",
    });
  });
});
