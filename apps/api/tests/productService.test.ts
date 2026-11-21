import { describe, expect, it } from "vitest";
import { createFixtureAdapter } from "../src/repositories/fixtureAdapter";
import { createProductService } from "../src/services/productService";
import { products } from "./fixtures/products";

const service = createProductService(createFixtureAdapter(products));

describe("productService.list", () => {
  it("returns every product with the total count", async () => {
    await expect(service.list({})).resolves.toEqual({
      products,
      total: products.length,
    });
  });

  it("filters by category case-insensitively", async () => {
    const result = await service.list({ category: "JEWELERY" });

    expect(result.products.map((product) => product.id)).toEqual([3]);
    expect(result.total).toBe(1);
  });

  it("searches title, description, and category", async () => {
    const byTitle = await service.list({ q: "backpack" });
    const byDescription = await service.list({ q: "usb 3.0" });
    const byCategory = await service.list({ q: "clothing" });

    expect(byTitle.products.map((product) => product.id)).toEqual([1]);
    expect(byDescription.products.map((product) => product.id)).toEqual([4]);
    expect(byCategory.products.map((product) => product.id)).toEqual([1, 2]);
  });

  it("applies the limit after filtering and keeps the pre-limit total", async () => {
    const result = await service.list({ category: "men's clothing", limit: 1 });

    expect(result.products.map((product) => product.id)).toEqual([1]);
    expect(result.total).toBe(2);
  });

  it("returns an empty result when nothing matches", async () => {
    await expect(service.list({ q: "no-such-product" })).resolves.toEqual({
      products: [],
      total: 0,
    });
  });
});
