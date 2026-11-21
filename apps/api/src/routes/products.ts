import { productQuerySchema } from "@catalogue/shared";
import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../errors";
import { asyncHandler } from "../middleware/asyncHandler";
import type { ProductService } from "../services/productService";

export function createProductsRouter(productService: ProductService): Router {
  const router = Router();

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

  return router;
}
