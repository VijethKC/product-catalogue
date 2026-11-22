import { randomUUID } from "node:crypto";
import type { EnquiryRequest, EnquiryResponse } from "@catalogue/shared";
import type { EmailProvider } from "../email/emailProvider";
import { HttpError } from "../errors";
import type { ProductRepository } from "../repositories/productRepository";

export interface EnquiryService {
  create(input: EnquiryRequest): Promise<EnquiryResponse>;
}

export interface EnquiryServiceDependencies {
  productRepository: ProductRepository;
  emailProvider: EmailProvider;
}

const SUCCESS_MESSAGE = "Thank you — we'll be in touch shortly.";

export function createEnquiryService({
  productRepository,
  emailProvider,
}: EnquiryServiceDependencies): EnquiryService {
  return {
    async create(input) {
      // An enquiry about a product that does not exist is a client error,
      // not something to email the sales inbox about.
      const product = await productRepository.getById(input.productId);

      if (product === null) {
        throw new HttpError(404, "PRODUCT_NOT_FOUND", "Product not found");
      }

      const id = `enq_${randomUUID()}`;

      try {
        await emailProvider.send({
          id,
          productId: product.id,
          productTitle: product.title,
          name: input.name,
          email: input.email,
          message: input.message,
        });
      } catch (error) {
        // Never report success when delivery failed; the client shows a retry.
        console.error(`Failed to send enquiry ${id}:`, error);
        throw new HttpError(
          502,
          "EMAIL_UNAVAILABLE",
          "The enquiry could not be sent. Please try again.",
        );
      }

      return { id, message: SUCCESS_MESSAGE };
    },
  };
}
