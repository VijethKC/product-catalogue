import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  clean: true,
  sourcemap: true,
  // The shared contract is TypeScript source, so bundle it into the API output.
  noExternal: ["@catalogue/shared"],
});
