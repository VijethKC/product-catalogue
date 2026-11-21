import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  FAKE_STORE_BASE_URL: z.url().default("https://fakestoreapi.com"),
  FEATURED_PRODUCT_IDS: z.string().default("1,2,3,4,5"),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default("sales@productcatalogue.local"),
  EMAIL_TO: z.string().default("sales-inbox@productcatalogue.local"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", z.flattenError(parsed.error).fieldErrors);
  throw new Error("Invalid environment configuration");
}

const featuredProductIds = parsed.data.FEATURED_PRODUCT_IDS.split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isInteger(value) && value > 0);

if (featuredProductIds.length === 0) {
  throw new Error("FEATURED_PRODUCT_IDS must contain at least one positive integer");
}

export const config = {
  ...parsed.data,
  featuredProductIds,
};
