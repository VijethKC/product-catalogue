import express from "express";
import helmet from "helmet";
import { config } from "./config";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { createFakeStoreAdapter } from "./repositories/fakeStoreAdapter";
import type { ProductRepository } from "./repositories/productRepository";
import { createProductsRouter } from "./routes/products";
import { createProductService } from "./services/productService";

export interface AppDependencies {
  productRepository?: ProductRepository;
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = express();

  const productRepository =
    dependencies.productRepository ??
    createFakeStoreAdapter({
      baseUrl: config.FAKE_STORE_BASE_URL,
      timeoutMs: config.FAKE_STORE_TIMEOUT_MS,
    });

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "32kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/products", createProductsRouter(createProductService(productRepository)));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
