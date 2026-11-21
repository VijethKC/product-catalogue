# Implementation Steps — Detailed Reference

> Living document. Use it to see what each step delivers, why, and how to verify it.
> Companion to [`PLAN.md`](./PLAN.md), which holds the overall architecture and decisions.
> Last updated: 2026-11-21

---

## Working agreement

- **Do not commit or push without the user's approval.** Changes stay in the working
  tree until explicitly approved.
- Implement in small, reviewable increments.
- Tests ship with the code they cover.
- Every step ends with `npm run typecheck`, `npm run test`, and `npm run build` passing.

---

## Status at a glance

| Step | Scope | Status |
|---|---|---|
| 0 | Scaffold: workspaces, shared contract, app shells, health | ✅ Done |
| 1 | Fake Store adapter + product service + `GET /api/products` | ✅ Done |
| 2 | Featured, categories, category split, product detail | ✅ Done |
| 3 | Enquiry endpoint + email provider (Mailpit) | ⬜ Next |
| 4 | Frontend pages, components, hooks, form | ⬜ Pending |
| 5 | Docker, nginx, compose, Mailpit wiring | ⬜ Pending |
| 6 | Docs (`README`, `DECISIONS`, `AI_USAGE`), PR | ⬜ Pending |

Progress: **3 of 7 steps** (0, 1 and 2).

---

## Step 0 — Scaffold ✅

### Goal
A working monorepo where both apps build, the API serves health, and the contract is shared.

### What was done
- npm workspaces: `apps/api`, `apps/web`, `packages/shared`.
- Root scripts: `dev`, `dev:api`, `dev:web`, `test`, `typecheck`, `build`.
- `packages/shared/src/index.ts` — Zod schemas and types: `Product`, `Rating`,
  `ProductQuery`, `EnquiryRequest`, `EnquiryResponse`, `CategoryProducts`,
  `ProductListResponse`, `ApiErrorBody`.
- Express shell: `createApp()`, helmet, JSON body limit, `/api/health`, 404 handler,
  central error handler, `HttpError`, Zod-validated config.
- React shell: Vite + Tailwind, placeholder `App.tsx`, test setup.
- Vite dev proxy: `/api` → `http://localhost:4000` (single origin).
- `.env.example`, `.gitignore`, `AGENTS.md`, `tsconfig.base.json`.
- Tests: health, 404 envelope, web shell render.

### Files
```
apps/api/src/{app,index,config,errors}.ts
apps/api/src/middleware/errorHandler.ts
apps/api/tests/health.test.ts
apps/web/src/{App,main}.tsx
packages/shared/src/index.ts
```

### Verify
```bash
npm run typecheck && npm run test && npm run build
npm run dev
curl localhost:4000/api/health          # {"status":"ok"}
curl localhost:5173/api/health          # proxied, same response
```

### Notes
- `dist/` folders are build output and gitignored.
- Node `engines` says `>=22.12`; README still says 20+ — fix in Step 6.

---

## Step 1 — Product repository and list endpoint ✅

### Goal
Fetch products from Fake Store through a replaceable adapter and expose a filtered list
endpoint. The browser never talks to Fake Store.

### What was done

**Repository seam**
- `ProductRepository` with `getAll(): Promise<Product[]>`.
- `FakeStoreAdapter`:
  - `GET {FAKE_STORE_BASE_URL}/products`, trailing slash normalized.
  - 5s timeout via `AbortSignal.timeout` (`FAKE_STORE_TIMEOUT_MS`).
  - Validates the payload with `z.array(productSchema)`.
  - Failure mapping: network/timeout/non-2xx → `502 UPSTREAM_UNAVAILABLE`;
    malformed JSON or schema mismatch → `502 UPSTREAM_INVALID_RESPONSE`.
  - Injected `fetchImpl` for deterministic tests.
- `FixtureAdapter` — in-memory repository used by tests and offline work.

**Service**
- `createProductService(repository).list(query)`:
  - `category`: case-insensitive exact match.
  - `q`: case-insensitive substring across title, description, category.
  - `limit`: applied after filtering.
  - `total`: number of matches **before** `limit`.

**Route**
- `GET /api/products?category=&q=&limit=`.
- Query parsed with `productQuerySchema`; invalid input → `400 VALIDATION_ERROR` with
  `details` from `z.flattenError`.
- `asyncHandler` forwards async rejections to the error middleware.

**Plumbing**
- `createApp({ productRepository })` dependency injection.
- `FAKE_STORE_TIMEOUT_MS` added to config and `.env.example`.

### Files
```
apps/api/src/repositories/{productRepository,fakeStoreAdapter,fixtureAdapter}.ts
apps/api/src/services/productService.ts
apps/api/src/routes/products.ts
apps/api/src/middleware/asyncHandler.ts
apps/api/src/{app,config}.ts                      (modified)
apps/api/tests/{products,productService,fakeStoreAdapter}.test.ts
apps/api/tests/fixtures/products.ts
```

### Contract
```
GET /api/products?category=electronics&q=drive&limit=2

200 {
  "products": [ { "id": 4, "title": "...", "price": 64, ... } ],
  "total": 1
}

400 { "error": { "code": "VALIDATION_ERROR", "message": "...", "details": { "q": [...] } } }
502 { "error": { "code": "UPSTREAM_UNAVAILABLE", "message": "..." } }
```

### Tests (22 API tests total)
- Service: all products, category case-insensitivity, search in title/description/category,
  limit + pre-limit total, empty result.
- Adapter: normalization, trailing slash, upstream 500, malformed JSON, schema mismatch,
  network failure, timeout abort.
- Route: list, category, search, limit, short `q` → 400, invalid limit → 400,
  repository 502 envelope, unexpected error → 500 without leaking details.

### Decisions and notes
- **No cache yet.** Optional per plan; skipped to avoid test-isolation complexity.
- **`total` semantics:** pre-limit. Documented in code comment; keep consistent in Step 2.
- **Timeout test uses an injected fetch stub**, because nock v15 + undici's abort produced
  an unhandled `assert(!this.aborted)` in the test process. Behaviour is still asserted
  (adapter maps abort to 502 and passes an `AbortSignal`).

### Verify
```bash
npm run typecheck && npm run test && npm run build
curl 'localhost:4000/api/products?limit=2'
curl 'localhost:4000/api/products?q=a'        # 400
```

---

## Step 2 — Featured, categories, category split, detail ✅

### Goal
Support the home page, category page, and product detail page with server-side business
rules. No frontend work in this step.

### Work items

1. **Extend `ProductRepository`**
   - Add `getById(id: number): Promise<Product | null>`.
   - Implement in `FakeStoreAdapter` (fetch `/products/:id`, validate with `productSchema`,
     `null` on 404) and `FixtureAdapter`.

2. **Featured products**
   - `GET /api/products/featured` → `ProductListResponse`.
   - Use curated `config.featuredProductIds` in config order — **not** computed top-5.
   - Skip IDs that do not exist, log a warning server-side.
   - Route order matters: declare `/featured` before `/:id`.

3. **Categories**
   - `GET /api/categories` → `{ categories: string[] }`, distinct, alphabetically sorted.
   - Add a `CategoriesResponse` type to `packages/shared`.

4. **Category page grouping**
   - `GET /api/categories/:category` → `CategoryProducts`.
   - Sort by `rating.rate` desc, then `rating.count` desc, then `id` asc.
   - First `FEATURED_PER_CATEGORY` (default 3) → `topRated`; remainder → `additional`.
   - Unknown category → `404 CATEGORY_NOT_FOUND`.
   - **Assumption to confirm:** the plan's endpoint table lists only `/api/categories`;
     the shared `CategoryProducts` type implies a grouped response. This endpoint keeps
     the 3-product rule server-side. Document in `DECISIONS.md`.

5. **Product detail**
   - `GET /api/products/:id` → `Product`.
   - Invalid id (non-integer, ≤ 0) → `400 VALIDATION_ERROR`.
   - Missing product → `404 PRODUCT_NOT_FOUND`.

### Files to add/modify
```
packages/shared/src/index.ts                       (CategoriesResponse)
apps/api/src/config.ts                             (FEATURED_PER_CATEGORY)
apps/api/src/repositories/productRepository.ts     (getById)
apps/api/src/repositories/fakeStoreAdapter.ts      (getById)
apps/api/src/repositories/fixtureAdapter.ts        (getById)
apps/api/src/services/productService.ts            (featured, categories, detail, split)
apps/api/src/routes/products.ts                    (/featured, /:id)
apps/api/src/routes/categories.ts                  (new)
apps/api/src/app.ts                                (mount categories router)
apps/api/tests/products.test.ts                    (extend)
apps/api/tests/categories.test.ts                  (new)
apps/api/tests/productService.test.ts              (extend)
```

### Acceptance
- Featured returns exactly the configured IDs in config order.
- Missing featured IDs are skipped without failing the request.
- Category split honours rate → count → id ordering and the configured threshold.
- Categories are distinct and sorted.
- Detail returns the product; unknown id → 404; bad id → 400.
- `npm run typecheck && npm run test && npm run build` green.

### Tests to write
- Featured: order, exact count, missing ID skipped, empty config impossible (validated).
- Category split: ordering ties, fewer than 3 products, exactly 3, more than 3.
- Categories: dedupe and sort.
- Detail: success, 404, 400.
- Adapter `getById`: success, 404 → `null`, upstream error → 502.

### Implemented — results and decisions

Delivered:
- `GET /api/products/featured` — curated IDs in config order, duplicates removed, missing IDs
  skipped with a server-side warning.
- `GET /api/products/:id` — `400` for a non-positive/non-integer id, `404 PRODUCT_NOT_FOUND`
  when missing.
- `GET /api/categories` — distinct, alphabetically sorted.
- `GET /api/categories/:category` — `CategoryProducts` with the rate → count → id ordering
  and `FEATURED_PER_CATEGORY` threshold (default 3); unknown category → `404 CATEGORY_NOT_FOUND`.
- `ProductRepository.getById` implemented in both adapters.
- `FEATURED_PER_CATEGORY` added to config and `.env.example`.
- `CategoriesResponse` added to the shared contract.

Decisions:
- **`/api/categories/:category` was added** to keep the top-3 rule server-side. The plan's
  endpoint table only listed `/api/categories`; the shared `CategoryProducts` type implied a
  grouped response. Recorded here as the working assumption.
- **Fake Store returns `200` with an empty body for unknown product IDs** (verified live),
  not `404`. The adapter treats an empty body or `null` payload as "not found", so the route
  returns `404 PRODUCT_NOT_FOUND` instead of a misleading `502`. A regression test covers both
  the empty-body and literal-`null` cases.
- **Route order:** `/featured` is declared before `/:id`, otherwise "featured" would be parsed
  as a product id.
- **Featured route test expects `[1, 2, 3, 4]`** because the fixtures contain ids 1–4 while
  the default config lists 1–5; the missing id is skipped and warned about.

Verification: 44 API tests pass, typecheck and build pass, and live checks against Fake Store
return featured `[1, 2, 3, 4, 5]`, electronics split `top [12, 11, 9] / more [10, 13, 14]`,
detail `200`, and unknown id `404 PRODUCT_NOT_FOUND`.

---

## Step 3 — Enquiry and email ⬜

### Goal
Collect an enquiry, validate it, verify the product exists, and send an email through a
replaceable provider. Mailpit captures it locally.

### Work items

1. **Email seam**
   - `EmailProvider` interface: `send(enquiry: EnquiryEmail): Promise<void>`.
   - `SmtpEmailProvider` using Nodemailer + config (`SMTP_*`, `EMAIL_FROM`, `EMAIL_TO`).
   - Escape all user-provided values interpolated into the HTML body.
   - Subject includes the product title; body includes name, email, message, product id.

2. **Service**
   - `createEnquiryService({ productRepository, emailProvider })`.
   - Verify the product exists; unknown → `404 PRODUCT_NOT_FOUND`.
   - Generate an id (`enq_<uuid>`), send, return `EnquiryResponse`.
   - Email failure → `502 EMAIL_UNAVAILABLE` (never report success).

3. **Route**
   - `POST /api/enquiries`, body parsed with `enquirySchema` → `201`.
   - Invalid body → `400 VALIDATION_ERROR` with field details.
   - Wire `emailProvider` through `createApp({ emailProvider })` for tests.

4. **Optional hardening (only if time permits)**
   - Honeypot field, basic per-IP rate limit on this route.

### Files to add
```
apps/api/src/email/{emailProvider,smtpProvider}.ts
apps/api/src/services/enquiryService.ts
apps/api/src/routes/enquiries.ts
apps/api/tests/enquiry.test.ts
apps/api/tests/email.test.ts
```

### Acceptance
- Invalid payload → 400 with field errors.
- Unknown product → 404.
- Valid enquiry → 201, fake provider receives the expected payload.
- Provider failure → 502 and no success response.
- HTML escaping covered by a unit test.
- Mailpit shows the message during manual verification.

---

## Step 4 — Frontend ⬜

### Goal
Deliver the five user-facing capabilities against our API only.

### Work items

1. **Data layer**
   - `src/api/client.ts` — fetch wrapper that parses the error envelope.
   - React Query hooks: `useProducts`, `useFeatured`, `useCategories`,
     `useCategoryProducts`, `useProduct`, `useCreateEnquiry`.

2. **Layout and routing**
   - Routes: `/`, `/categories/:category`, `/search?q=`, `/products/:id`, `*`.
   - Header with search form (button or Enter) and category navigation.
   - Tailwind-based responsive layout from 360px up.

3. **Pages and components**
   - `ProductCard`, `ProductGrid`, `EnquiryForm`, `LoadingState`, `ErrorState`,
     `EmptyState`.
   - Home: hero + 5 featured.
   - Category: "Top rated" section + "More in …".
   - Search: results, empty state, minimum 2 characters.
   - Detail: full info + enquiry form.
   - Thank-you confirmation after successful enquiry.

4. **Accessibility and resilience**
   - Semantic landmarks, labelled inputs, visible focus, `aria-live` for async feedback.
   - Disable the submit button while pending; show readable errors.

### Tests (Vitest + RTL + MSW)
- Home renders exactly 5 featured cards.
- Category renders both sections.
- Search submit updates results; empty state.
- Detail renders data; form validation.
- Enquiry success → thank-you; failure → error.
- Error state + retry.

> MSW is not installed yet; add it to `apps/web` devDependencies in this step.

### Acceptance
- All five capabilities work end to end in the browser against the real API.
- No direct Fake Store calls from the browser.
- Web tests green; typecheck/build green.

---

## Step 5 — Docker and local run ⬜

### Goal
A reviewer runs the whole stack with two commands.

### Work items
- `apps/api/Dockerfile` — multi-stage build, non-root, healthcheck.
- `apps/web/Dockerfile` — Vite build served by nginx.
- `apps/web/nginx.conf` — SPA fallback + `/api` proxy to `api:4000`.
- `docker-compose.yml` — `web` (8080), `api` (4000), `mailpit` (8025 UI / 1025 SMTP),
  healthchecks and `depends_on`.
- Update `.env.example` with any new compose variables.

### Acceptance
```bash
cp .env.example .env
docker compose up --build
```
- App at `http://localhost:8080`.
- Mailpit at `http://localhost:8025`.
- Enquiry submitted in the UI appears in Mailpit.
- Works from a clean clone.

---

## Step 6 — Documentation and PR ⬜

### Work items
- `README.md`: overview, architecture diagram, quick start (Docker + dev), endpoints,
  scripts, configuration, trade-offs.
- `docs/DECISIONS.md`: curated featured IDs, top-3 category rule, `q` vs `search`,
  no persistence, Mailpit capture, caching deferred, no rate limiting.
- `docs/AI_USAGE.md`: tools/models, prompt strategy, review process, at least one real AI
  mistake and how it was caught.
- Fix the Node version mismatch (`engines` vs README).
- PR description with an acceptance-criteria → implementation table and screenshots.

### Acceptance
- A reviewer can understand the architecture and run the app without reading source.
- Every acceptance criterion maps to code and a test.
- PR is open from `feat/product-catalogue` into `main`.

---

## Cross-cutting reference

### Error codes

| Code | Status | When |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid query, body, or path parameter |
| `NOT_FOUND` | 404 | Unknown route |
| `PRODUCT_NOT_FOUND` | 404 | Unknown product id |
| `CATEGORY_NOT_FOUND` | 404 | Unknown category |
| `UPSTREAM_UNAVAILABLE` | 502 | Fake Store network/timeout/non-2xx |
| `UPSTREAM_INVALID_RESPONSE` | 502 | Fake Store payload violates the contract |
| `EMAIL_UNAVAILABLE` | 502 | SMTP delivery failed |
| `INTERNAL_ERROR` | 500 | Unexpected failure (details never leaked) |

### Environment variables

| Variable | Default | Used by |
|---|---|---|
| `PORT` | 4000 | API |
| `NODE_ENV` | development | API |
| `FAKE_STORE_BASE_URL` | https://fakestoreapi.com | Adapter |
| `FAKE_STORE_TIMEOUT_MS` | 5000 | Adapter |
| `FEATURED_PRODUCT_IDS` | 1,2,3,4,5 | Featured endpoint |
| `FEATURED_PER_CATEGORY` | 3 (to add) | Category split |
| `SMTP_HOST` / `SMTP_PORT` | localhost / 1025 | Email |
| `SMTP_USER` / `SMTP_PASS` | empty | Email |
| `EMAIL_FROM` / `EMAIL_TO` | local addresses | Email |

### Verification commands

```bash
npm run typecheck          # all workspaces
npm run test               # api + web
npm run build              # api bundle + web production build
npm run dev                # api :4000 + web :5173
```

### Commit and push policy

**Do not commit or push until the user approves.** Stage and describe the change, then
wait. This applies to every step from Step 1 onward.
