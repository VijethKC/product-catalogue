import type { Product } from "@catalogue/shared";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { ApiError, api } from "./api/client";
import { featuredProducts, products } from "./test/fixtures";
import { renderApp } from "./test/render";

vi.mock("./api/client", () => ({
  api: {
    listProducts: vi.fn(),
    getFeatured: vi.fn(),
    getProduct: vi.fn(),
    getCategories: vi.fn(),
    getCategoryProducts: vi.fn(),
    createEnquiry: vi.fn(),
  },
  ApiError: class MockApiError extends Error {
    constructor(
      public readonly status: number,
      public readonly code: string,
      message: string,
    ) {
      super(message);
      this.name = "ApiError";
    }
  },
}));

const mockedApi = vi.mocked(api);

function productById(id: number): Product {
  const product = products.find((item) => item.id === id);

  if (product === undefined) {
    throw new Error(`Missing fixture product ${id}`);
  }

  return product;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.getCategories.mockResolvedValue({
    categories: ["electronics", "jewelery", "men's clothing"],
  });
});

describe("Home page", () => {
  it("renders the featured products", async () => {
    mockedApi.getFeatured.mockResolvedValue({
      products: featuredProducts,
      total: featuredProducts.length,
    });

    renderApp(<App />);

    expect(
      await screen.findByRole("heading", { name: "Top rated products" }),
    ).toBeInTheDocument();
    expect(await screen.findAllByRole("heading", { level: 3 })).toHaveLength(
      featuredProducts.length,
    );
  });

  it("shows an error state with a retry action", async () => {
    mockedApi.getFeatured.mockRejectedValue(new Error("upstream down"));

    renderApp(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong",
    );
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });
});

describe("Category page", () => {
  it("renders top rated and additional sections", async () => {
    const clothing = products.filter(
      (product) => product.category === "men's clothing",
    );

    mockedApi.getCategoryProducts.mockResolvedValue({
      category: "men's clothing",
      topRated: clothing.slice(0, 1),
      additional: clothing.slice(1),
    });

    renderApp(<App />, { route: "/categories/men's%20clothing" });

    expect(
      await screen.findByRole("heading", { name: "Men's clothing" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Top rated" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "More in Men's clothing" }),
    ).toBeInTheDocument();
  });

  it("shows a not-found state for an unknown category", async () => {
    mockedApi.getCategoryProducts.mockRejectedValue(
      new ApiError(404, "CATEGORY_NOT_FOUND", "Category not found"),
    );

    renderApp(<App />, { route: "/categories/nope" });

    expect(
      await screen.findByText("Category not found"),
    ).toBeInTheDocument();
  });
});

describe("Search page", () => {
  it("submits a search and renders matching products", async () => {
    const user = userEvent.setup();
    const drive = productById(4);

    mockedApi.listProducts.mockResolvedValue({
      products: [drive],
      total: 1,
    });

    renderApp(<App />, { route: "/search" });

    await user.type(screen.getByLabelText("Search products"), "drive");
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(
      await screen.findByRole("heading", {
        name: /search results for .*drive/i,
      }),
    ).toBeInTheDocument();
    expect(mockedApi.listProducts).toHaveBeenCalledWith({ q: "drive" });
    expect(
      await screen.findByRole("heading", { level: 3, name: drive.title }),
    ).toBeInTheDocument();
  });

  it("asks for at least two characters", async () => {
    const user = userEvent.setup();

    renderApp(<App />, { route: "/search" });

    await user.type(screen.getByLabelText("Search products"), "a");
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(
      screen.getByText("Enter at least 2 characters"),
    ).toBeInTheDocument();
    expect(mockedApi.listProducts).not.toHaveBeenCalled();
  });

  it("redirects to the homepage when the search is empty", async () => {
    const user = userEvent.setup();

    mockedApi.getFeatured.mockResolvedValue({
      products: featuredProducts,
      total: featuredProducts.length,
    });

    renderApp(<App />, { route: "/search" });

    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(
      await screen.findByRole("heading", { name: "Top rated products" }),
    ).toBeInTheDocument();
    expect(mockedApi.listProducts).not.toHaveBeenCalled();
  });
});

describe("Product detail page", () => {
  it("sends an enquiry and shows the thank-you message", async () => {
    const user = userEvent.setup();
    const drive = productById(4);

    mockedApi.getProduct.mockResolvedValue(drive);
    mockedApi.createEnquiry.mockResolvedValue({
      id: "enq_1",
      message: "Thank you — we'll be in touch shortly.",
    });

    renderApp(<App />, { route: "/products/4" });

    expect(
      await screen.findByRole("heading", { name: drive.title }),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("Name"), "Ada Lovelace");
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(
      screen.getByLabelText("Message (optional)"),
      "Is it in stock?",
    );
    await user.click(screen.getByRole("button", { name: "Send enquiry" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Thank you");
    expect(mockedApi.createEnquiry).toHaveBeenCalledWith({
      productId: 4,
      name: "Ada Lovelace",
      email: "ada@example.com",
      message: "Is it in stock?",
    });
  });

  it("validates required fields before sending", async () => {
    const user = userEvent.setup();

    mockedApi.getProduct.mockResolvedValue(productById(4));

    renderApp(<App />, { route: "/products/4" });

    await screen.findByRole("heading", { name: productById(4).title });
    await user.click(screen.getByRole("button", { name: "Send enquiry" }));

    expect(mockedApi.createEnquiry).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Name")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("shows a not-found state for an unknown product", async () => {
    mockedApi.getProduct.mockRejectedValue(
      new ApiError(404, "PRODUCT_NOT_FOUND", "Product not found"),
    );

    renderApp(<App />, { route: "/products/999" });

    expect(await screen.findByText("Product not found")).toBeInTheDocument();
  });
});

describe("Unknown route", () => {
  it("renders the 404 page", () => {
    renderApp(<App />, { route: "/does-not-exist" });

    expect(
      screen.getByRole("heading", { name: /couldn.t find that page/i }),
    ).toBeInTheDocument();
  });
});
