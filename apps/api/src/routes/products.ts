import { productQuerySchema } from "@catalogue/shared";
import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../errors";
import { asyncHandler } from "../middleware/asyncHandler";
import type { ProductService } from "../services/productService";

const productIdSchema = z.coerce.number().int().positive();

export function createProductsRouter(productService: ProductService): Router {
  const router = Router();

  router.get(
    "/featured",
    asyncHandler(async (_req, res) => {
      res.json(await productService.getFeatured());
    }),
  );

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const parsed = productQuerySchema.safeParse(req.query);

      if (!parsed.success) {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "Invalid query parameters",
          z.flattenError(parsed.error).fieldErrors,
        );
      }

      res.json(await productService.list(parsed.data));
    }),
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const parsed = productIdSchema.safeParse(req.params.id);

      if (!parsed.success) {
        throw new HttpError(400, "VALIDATION_ERROR", "Invalid product id", {
          id: z.flattenError(parsed.error).formErrors,
        });
      }

      const product = await productService.getById(parsed.data);

      if (product === null) {
        throw new HttpError(404, "PRODUCT_NOT_FOUND", "Product not found");
      }

      res.json(product);
    }),
  );

  return router;
}
