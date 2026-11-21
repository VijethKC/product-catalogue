import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../errors";
import { asyncHandler } from "../middleware/asyncHandler";
import type { ProductService } from "../services/productService";

const categorySchema = z.string().trim().min(1).max(100);

export function createCategoriesRouter(productService: ProductService): Router {
  const router = Router();

  router.get(
    "/",
    asyncHandler(async (_req, res) => {
      res.json({ categories: await productService.listCategories() });
    }),
  );

  router.get(
    "/:category",
    asyncHandler(async (req, res) => {
      const parsed = categorySchema.safeParse(req.params.category);

      if (!parsed.success) {
        throw new HttpError(400, "VALIDATION_ERROR", "Invalid category", {
          category: z.flattenError(parsed.error).formErrors,
        });
      }

      const result = await productService.getCategoryProducts(parsed.data);

      if (result === null) {
        throw new HttpError(404, "CATEGORY_NOT_FOUND", "Category not found");
      }

      res.json(result);
    }),
  );

  return router;
}
