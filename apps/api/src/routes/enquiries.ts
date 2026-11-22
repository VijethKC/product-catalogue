import { enquirySchema } from "@catalogue/shared";
import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../errors";
import { asyncHandler } from "../middleware/asyncHandler";
import type { EnquiryService } from "../services/enquiryService";

export function createEnquiriesRouter(enquiryService: EnquiryService): Router {
  const router = Router();

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const parsed = enquirySchema.safeParse(req.body);

      if (!parsed.success) {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "Invalid enquiry",
          z.flattenError(parsed.error).fieldErrors,
        );
      }

      res.status(201).json(await enquiryService.create(parsed.data));
    }),
  );

  return router;
}
