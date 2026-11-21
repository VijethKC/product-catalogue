import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { HttpError } from "../src/errors";
import { createFixtureAdapter } from "../src/repositories/fixtureAdapter";
import { products } from "./fixtures/products";

function appWithFixtures() {
  return createApp({ productRepository: createFixtureAdapter(products) });
}

describe("GET /api/products", () => {
  it("returns products and the total count", async () => {
    const response = await request(appWithFixtures()).get("/api/products");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ products, total: products.length });
  });

  it("filters by category", async () => {
    const response = await request(appWithFixtures()).get(
      "/api/products?category=Jewelery",
    );

    expect(response.status).toBe(200);
    expect(response.body.products.map((product: { id: number }) => product.id)).toEqual([3]);
    expect(response.body.total).toBe(1);
  });

  it("searches with the q parameter", async () => {
    const response = await request(appWithFixtures()).get(
      "/api/products?q=hard%20drive",
    );

    expect(response.status).toBe(200);
    expect(response.body.products.map((product: { id: number }) => product.id)).toEqual([4]);
  });

  it("applies limit while keeping the pre-limit total", async () => {
    const response = await request(appWithFixtures()).get(
      "/api/products?limit=1",
    );

    expect(response.status).toBe(200);
    expect(response.body.products).toHaveLength(1);
    expect(response.body.total).toBe(products.length);
  });

  it("rejects a search term shorter than two characters", async () => {
    const response = await request(appWithFixtures()).get("/api/products?q=a");

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({ code: "VALIDATION_ERROR" });
    expect(response.body.error.details).toHaveProperty("q");
  });

  it("rejects an invalid limit", async () => {
    const response = await request(appWithFixtures()).get(
      "/api/products?limit=0",
    );

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({ code: "VALIDATION_ERROR" });
    expect(response.body.error.details).toHaveProperty("limit");
  });

  it("maps repository failures to the error envelope", async () => {
    const app = createApp({
      productRepository: {
        getAll: async () => {
          throw new HttpError(
            502,
            "UPSTREAM_UNAVAILABLE",
            "The product data source is unavailable",
          );
        },
        getById: async () => null,
      },
    });

    const response = await request(app).get("/api/products");

    expect(response.status).toBe(502);
    expect(response.body).toEqual({
      error: {
        code: "UPSTREAM_UNAVAILABLE",
        message: "The product data source is unavailable",
      },
    });
  });

  it("does not leak unexpected error details", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = createApp({
      productRepository: {
        getAll: async () => {
          throw new Error("secret database connection string");
        },
        getById: async () => null,
      },
    });

    const response = await request(app).get("/api/products");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
    });
    expect(JSON.stringify(response.body)).not.toContain("secret database");

    consoleError.mockRestore();
  });
});

describe("GET /api/products/featured", () => {
  it("returns the configured featured products in order", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const response = await request(appWithFixtures()).get(
      "/api/products/featured",
    );

    expect(response.status).toBe(200);
    expect(
      response.body.products.map((item: { id: number }) => item.id),
    ).toEqual([1, 2, 3, 4]);
    expect(response.body.total).toBe(4);

    warn.mockRestore();
  });
});

describe("GET /api/products/:id", () => {
  it("returns a product by id", async () => {
    const response = await request(appWithFixtures()).get("/api/products/2");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: 2, title: expect.any(String) });
  });

  it("returns 404 for an unknown product", async () => {
    const response = await request(appWithFixtures()).get("/api/products/99");

    expect(response.status).toBe(404);
    expect(response.body.error).toEqual({
      code: "PRODUCT_NOT_FOUND",
      message: "Product not found",
    });
  });

  it("returns 400 for an invalid product id", async () => {
    const response = await request(appWithFixtures()).get("/api/products/abc");

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({ code: "VALIDATION_ERROR" });
    expect(response.body.error.details).toHaveProperty("id");
  });
});
