import type {
  ApiErrorBody,
  CategoriesResponse,
  CategoryProducts,
  EnquiryRequest,
  EnquiryResponse,
  Product,
  ProductListResponse,
  ProductQuery,
} from "@catalogue/shared";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(path, {
      method: options.method ?? "GET",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Unable to reach the server");
  }

  if (!response.ok) {
    let body: ApiErrorBody | undefined;

    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      body = undefined;
    }

    throw new ApiError(
      response.status,
      body?.error.code ?? "UNKNOWN_ERROR",
      body?.error.message ?? "The request failed",
      body?.error.details,
    );
  }

  // Our own API owns this contract; the shared package defines the shapes.
  return (await response.json()) as T;
}

function toQueryString(params: ProductQuery): string {
  const search = new URLSearchParams();

  if (params.category !== undefined) {
    search.set("category", params.category);
  }

  if (params.q !== undefined) {
    search.set("q", params.q);
  }

  if (params.limit !== undefined) {
    search.set("limit", String(params.limit));
  }

  const query = search.toString();

  return query === "" ? "" : `?${query}`;
}

export const api = {
  listProducts(params: ProductQuery = {}): Promise<ProductListResponse> {
    return request(`/api/products${toQueryString(params)}`);
  },

  getFeatured(): Promise<ProductListResponse> {
    return request("/api/products/featured");
  },

  getProduct(id: number): Promise<Product> {
    return request(`/api/products/${id}`);
  },

  getCategories(): Promise<CategoriesResponse> {
    return request("/api/categories");
  },

  getCategoryProducts(category: string): Promise<CategoryProducts> {
    return request(`/api/categories/${encodeURIComponent(category)}`);
  },

  createEnquiry(payload: EnquiryRequest): Promise<EnquiryResponse> {
    return request("/api/enquiries", { method: "POST", body: payload });
  },
};
