import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { createFixtureAdapter } from "../src/repositories/fixtureAdapter";
import { products } from "./fixtures/products";

const app = createApp({ productRepository: createFixtureAdapter(products) });

describe("GET /api/categories", () => {
  it("returns distinct categories sorted alphabetically", async () => {
    const response = await request(app).get("/api/categories");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      categories: ["electronics", "jewelery", "men's clothing"],
    });
  });
});

describe("GET /api/categories/:category", () => {
  it("returns grouped products for a category case-insensitively", async () => {
    const response = await request(app).get(
      `/api/categories/${encodeURIComponent("MEN'S CLOTHING")}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.category).toBe("men's clothing");
    expect(
      response.body.topRated.map((item: { id: number }) => item.id),
    ).toEqual([2, 1]);
    expect(response.body.additional).toEqual([]);
  });

  it("returns 404 for an unknown category", async () => {
    const response = await request(app).get("/api/categories/nope");

    expect(response.status).toBe(404);
    expect(response.body.error).toEqual({
      code: "CATEGORY_NOT_FOUND",
      message: "Category not found",
    });
  });
});
