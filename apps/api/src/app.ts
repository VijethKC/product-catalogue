import express from "express";
import helmet from "helmet";
import { config } from "./config";
import type { EmailProvider } from "./email/emailProvider";
import { createSmtpEmailProvider } from "./email/smtpProvider";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { createFakeStoreAdapter } from "./repositories/fakeStoreAdapter";
import type { ProductRepository } from "./repositories/productRepository";
import { createCategoriesRouter } from "./routes/categories";
import { createEnquiriesRouter } from "./routes/enquiries";
import { createProductsRouter } from "./routes/products";
import { createEnquiryService } from "./services/enquiryService";
import { createProductService } from "./services/productService";

export interface AppDependencies {
  productRepository?: ProductRepository;
  emailProvider?: EmailProvider;
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = express();

  const productRepository =
    dependencies.productRepository ??
    createFakeStoreAdapter({
      baseUrl: config.FAKE_STORE_BASE_URL,
      timeoutMs: config.FAKE_STORE_TIMEOUT_MS,
    });

  const productService = createProductService(productRepository, {
    featuredProductIds: config.featuredProductIds,
    featuredPerCategory: config.FEATURED_PER_CATEGORY,
  });

  const emailProvider =
    dependencies.emailProvider ??
    createSmtpEmailProvider({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      user: config.SMTP_USER,
      pass: config.SMTP_PASS,
      from: config.EMAIL_FROM,
      to: config.EMAIL_TO,
    });

  const enquiryService = createEnquiryService({
    productRepository,
    emailProvider,
  });

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "32kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/products", createProductsRouter(productService));
  app.use("/api/categories", createCategoriesRouter(productService));
  app.use("/api/enquiries", createEnquiriesRouter(enquiryService));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
