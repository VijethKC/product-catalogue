import nock from "nock";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeStoreAdapter } from "../src/repositories/fakeStoreAdapter";
import { products } from "./fixtures/products";

const baseUrl = "https://fake-store.test";

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
