import type { Product } from "@catalogue/shared";
import { describe, expect, it, vi } from "vitest";
import { createFixtureAdapter } from "../src/repositories/fixtureAdapter";
import { createProductService } from "../src/services/productService";
import { products } from "./fixtures/products";

const service = createProductService(createFixtureAdapter(products), {
  featuredProductIds: [3, 1, 99],
  featuredPerCategory: 1,
});

function product(
  id: number,
  rate: number,
  count: number,
  category = "test",
): Product {
  return {
    id,
    title: `Product ${id}`,
    price: 1,
    description: "Fixture product",
    category,
    image: `https://example.com/images/${id}.jpg`,
    rating: { rate, count },
  };
}

describe("productService.list", () => {
  it("returns every product with the total count", async () => {
    await expect(service.list({})).resolves.toEqual({
      products,
      total: products.length,
    });
  });

  it("filters by category case-insensitively", async () => {
    const result = await service.list({ category: "JEWELERY" });

    expect(result.products.map((item) => item.id)).toEqual([3]);
    expect(result.total).toBe(1);
  });

  it("searches title, description, and category", async () => {
    const byTitle = await service.list({ q: "backpack" });
    const byDescription = await service.list({ q: "usb 3.0" });
    const byCategory = await service.list({ q: "clothing" });

    expect(byTitle.products.map((item) => item.id)).toEqual([1]);
    expect(byDescription.products.map((item) => item.id)).toEqual([4]);
    expect(byCategory.products.map((item) => item.id)).toEqual([1, 2]);
  });

  it("applies the limit after filtering and keeps the pre-limit total", async () => {
    const result = await service.list({ category: "men's clothing", limit: 1 });

    expect(result.products.map((item) => item.id)).toEqual([1]);
    expect(result.total).toBe(2);
  });

  it("returns an empty result when nothing matches", async () => {
    await expect(service.list({ q: "no-such-product" })).resolves.toEqual({
      products: [],
      total: 0,
    });
  });
});

describe("productService.getFeatured", () => {
  it("returns products in configured order and skips unknown IDs", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await service.getFeatured();

    expect(result.products.map((item) => item.id)).toEqual([3, 1]);
    expect(result.total).toBe(2);
    expect(warn).toHaveBeenCalledWith(
      "Featured product IDs not found upstream: 99",
    );

    warn.mockRestore();
  });

  it("does not repeat a product when an ID is configured twice", async () => {
    const deduped = createProductService(createFixtureAdapter(products), {
      featuredProductIds: [1, 1, 3],
      featuredPerCategory: 1,
    });

    const result = await deduped.getFeatured();

    expect(result.products.map((item) => item.id)).toEqual([1, 3]);
  });
});

describe("productService.getById", () => {
  it("returns a product when it exists", async () => {
    await expect(service.getById(2)).resolves.toMatchObject({ id: 2 });
  });

  it("returns null when the product does not exist", async () => {
    await expect(service.getById(99)).resolves.toBeNull();
  });
});

describe("productService.listCategories", () => {
  it("returns distinct categories sorted alphabetically", async () => {
    await expect(service.listCategories()).resolves.toEqual([
      "electronics",
      "jewelery",
      "men's clothing",
    ]);
  });
});

describe("productService.getCategoryProducts", () => {
  it("splits a category into top rated and additional products", async () => {
    const result = await service.getCategoryProducts("MEN'S CLOTHING");

    expect(result).not.toBeNull();
    expect(result?.category).toBe("men's clothing");
    expect(result?.topRated.map((item) => item.id)).toEqual([2]);
    expect(result?.additional.map((item) => item.id)).toEqual([1]);
  });

  it("keeps everything in top rated when the category is smaller than the threshold", async () => {
    const small = createProductService(createFixtureAdapter(products), {
      featuredProductIds: [],
      featuredPerCategory: 3,
    });

    const result = await small.getCategoryProducts("jewelery");

    expect(result?.topRated.map((item) => item.id)).toEqual([3]);
    expect(result?.additional).toEqual([]);
  });

  it("orders by rating, then review count, then id", async () => {
    const ordered = createProductService(
      createFixtureAdapter([
        product(10, 4, 5),
        product(11, 4, 9),
        product(12, 4.8, 1),
        product(9, 4, 5),
      ]),
      { featuredProductIds: [], featuredPerCategory: 3 },
    );

    const result = await ordered.getCategoryProducts("test");

    expect(result?.topRated.map((item) => item.id)).toEqual([12, 11, 9]);
    expect(result?.additional.map((item) => item.id)).toEqual([10]);
  });

  it("returns null for an unknown category", async () => {
    await expect(service.getCategoryProducts("nope")).resolves.toBeNull();
  });
});
