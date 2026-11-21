import { z } from "zod";

/**
 * The API contract. Both the Express backend and the React client import
 * these schemas so request/response shapes cannot drift apart.
 */

export const ratingSchema = z.object({
  rate: z.number().nonnegative(),
  count: z.number().int().nonnegative(),
});

export const productSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
  price: z.number().nonnegative(),
  description: z.string(),
  category: z.string().min(1),
  image: z.url(),
  rating: ratingSchema,
});

export type Product = z.infer<typeof productSchema>;
export type Rating = z.infer<typeof ratingSchema>;

export const productQuerySchema = z.object({
  category: z.string().trim().min(1).optional(),
  q: z.string().trim().min(2).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type ProductQuery = z.infer<typeof productQuerySchema>;

export const enquirySchema = z.object({
  productId: z.number().int().positive(),
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().pipe(z.email().max(254)),
  message: z.string().trim().max(2000).optional().default(""),
});

export type EnquiryRequest = z.infer<typeof enquirySchema>;

export interface EnquiryResponse {
  id: string;
  message: string;
}

export interface CategoryProducts {
  category: string;
  topRated: Product[];
  additional: Product[];
}

export interface ProductListResponse {
  products: Product[];
  total: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
