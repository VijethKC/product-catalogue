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
| 3 | Enquiry endpoint + email provider (Mailpit) | ✅ Done |
| 4 | Frontend pages, components, hooks, form | ✅ Done |
| 5 | Docker, nginx, compose, Mailpit wiring | ✅ Done |
| 6 | Docs (`README`, `DECISIONS`, `AI_USAGE`), PR | ✅ Done (PR prepared, not opened) |

Progress: **7 of 7 steps** (0–6).

Beyond the plan: CI in `.github/workflows/` — see *After the plan* below.

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

## Step 3 — Enquiry and email ✅

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

### Implemented — results and decisions

Delivered:
- `src/email/emailProvider.ts` — `EmailProvider` seam and the `EnquiryEmail` shape.
- `src/email/smtpProvider.ts` — Nodemailer transport, message builder, HTML escaping and
  header sanitisation.
- `src/services/enquiryService.ts` — product check, id generation, send, error mapping.
- `src/routes/enquiries.ts` — `POST /api/enquiries`, shared-schema validation, `201`.
- `createApp` accepts an injected `emailProvider`; the default is SMTP from config.
- `express.json` parse failures now return `400 VALIDATION_ERROR` instead of `500`.
- 18 new tests: route/service behaviour and email formatting/escaping.

Verification: 62 API tests pass; typecheck and build pass. Live check against a local SMTP
sink on `1025` produced the expected multipart message with escaped HTML, and returned
`201`, `404`, `400` and `400` for valid, unknown-product, invalid-payload and malformed-JSON
requests respectively.

Decisions:
- **Failure is never reported as success.** Any provider error becomes `502 EMAIL_UNAVAILABLE`
  and the underlying error is logged; the UI already renders its retry state for this.
- **Escape everything rendered into HTML**, including the product title. The title comes from
  upstream rather than the user, but escaping it costs nothing and removes a whole class of
  injection bugs.
- **Strip CR/LF from the subject** so submitted values cannot inject headers.
- **Trimmed values come from the shared schema**, so the email contains the same normalised
  values the API validated.
- **SMTP timeouts** (5s connect/greet, 10s socket) keep a dead mail server from holding the
  HTTP request open.
- **Mailpit is not installed yet** (Docker arrives in Step 5), so the manual acceptance check
  used a minimal local SMTP sink. The SMTP provider code path is the same one Mailpit will
  exercise.

---

## Step 4 — Frontend ✅

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

> Implemented without MSW: tests mock the typed `api` module, so no extra dependency
> was added.

### Acceptance
- All five capabilities work end to end in the browser against the real API.
- No direct Fake Store calls from the browser.
- Web tests green; typecheck/build green.

### Implemented — results and decisions

Delivered:
- `src/api/client.ts` — typed fetch wrapper, query-string builder, error-envelope parsing,
  `ApiError`.
- `src/hooks/useCatalogue.ts` — React Query hooks for featured, list/search, categories,
  category detail, product detail, and enquiry mutation.
- Router + layout: sticky header, search form, category nav, skip link, footer.
- Pages: Home, Category, Search, Product detail, 404.
- Components: `ProductCard`, `ProductGrid`, `RatingStars`, `Price`, `EnquiryForm`,
  `ProductGridSkeleton`, `ErrorState`, `EmptyState`.
- Enquiry form validates against the shared `enquirySchema` (reads `issues` directly, so
  the web app does not need its own Zod import).

Verification: 10 web tests pass; typecheck and build pass. Production bundle is ~395 KB JS
(~121 KB gzip) and ~13.6 KB CSS.

Decisions:
- **No MSW.** Tests `vi.mock` the typed `api` module. This avoids a new dependency and keeps
  tests focused on user-visible behaviour. The fetch layer is exercised by live checks.
- **Enquiry submit is already wired to `POST /api/enquiries`**, which does not exist until
  Step 3. Until Step 3 lands, a live submit shows the form's failure state; the success path
  is covered by a mocked test. This is the known ordering trade-off from deferring Step 3.
- **USD formatting** via `Intl.NumberFormat`; no currency config was required.
- **Minimum search length of 2** is enforced in the UI and by the API contract.

---

## Step 5 — Docker and local run ✅

### Goal
The whole stack starts with two commands.

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

### Implemented — results and decisions

Delivered:
- `apps/api/Dockerfile` — multi-stage build, production-only dependencies, non-root `node`
  user, `HEALTHCHECK` on `/api/health`.
- `apps/web/Dockerfile` — Vite build in a Node stage, served by `nginx:1.27-alpine`.
- `apps/web/nginx.conf` — SPA fallback, `/api` proxy to `api:4000`, immutable asset caching.
- `docker-compose.yml` — `mailpit`, `api`, `web` with healthchecks and ordered startup.
- `.dockerignore` — keeps `node_modules`, `dist`, `.env` and docs out of the build context.
- `.env.example` — compose host ports.

Verification (Docker Desktop 29.9.3 / Compose v5.7.0):

```
docker compose up --build -d   ✅ images built, containers started
docker compose ps              ✅ api, web, mailpit all healthy
http://localhost:8080/         ✅ 200, SPA shell
http://localhost:8080/products/4 ✅ 200, client-side route served by nginx
http://localhost:8080/api/health ✅ {"status":"ok"} through the proxy
/api/products/featured via 8080 ✅ 5 curated products
http://localhost:8025/         ✅ Mailpit UI
POST /api/enquiries via 8080   ✅ 201, message appears in Mailpit
Browser form submit on :8080   ✅ thank-you state, second message in Mailpit
```

The captured message had the expected subject, plain-text and HTML parts, escaped
`&lt;script&gt;` content, and newlines rendered as `<br>`. The API container runs as
`uid=1000(node)`, not root. Image sizes: api 256 MB, web 76.5 MB.

The build context excluded local `node_modules`, `dist` and `.env` via `.dockerignore`, so
the images were built from repository sources only — the same inputs a clean clone provides.

Decisions:
- **Build context is the repository root** for both images, because npm workspaces need the
  root lockfile and every workspace manifest. Compose sets `context: .` with an explicit
  `dockerfile:`.
- **Workspace-filtered installs** keep the API image small: `-w @catalogue/api` plus
  `--omit=dev` avoids shipping the web app's React/Vite tree.
- **Compose does not use `env_file`.** `.env` is used for interpolation only, so the API
  container always gets `SMTP_HOST=mailpit` rather than the dev value `localhost`.
- **nginx forwards `/api/…` unchanged** (`proxy_pass http://api:4000` with no path suffix),
  so the Express routes match exactly as they do behind the Vite proxy.
- **Mailpit is pinned** to `v1.34` for reproducible review runs.
- **Healthchecks gate startup**: web waits for api, api waits for mailpit.

---

## Step 6 — Documentation and PR ✅

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
- A developer can understand the architecture and run the app without reading source.
- Every acceptance criterion maps to code and a test.
- PR is open from `feat/product-catalogue` into `main`.

### Implemented — results and decisions

Delivered:
- `README.md` — rewritten: capabilities, ASCII architecture diagram, Docker and local quick
  starts, endpoint and error tables, structure, scripts, full configuration table, testing
  summary, trade-offs, and a docs index.
- `docs/DECISIONS.md` — 18 decisions, each with context, the alternative rejected, and the
  cost accepted. Covers the seams, curated featured ids, the top-3 rule, `q`, statelessness,
  Mailpit, failure-never-success, escaping, single-origin proxying, deferred caching, the
  missing rate limiting, the MSW deviation, Node 22.22.2, the Docker build shape, compose
  interpolation, and the deliberate cuts.
- `docs/AI_USAGE.md` — tools, prompt strategy, repository guardrails, the human review
  checklist, five real defects with how each was caught, and an honest limits section.
- `docs/PULL_REQUEST.md` — paste-ready PR body with the acceptance-criteria → implementation
  → test table, verification output, assumptions, and out-of-scope list.
- Node version mismatch fixed: the README now states 22.22.2+ (or 24.15+), matching
  `engines` and the container image. CI later showed the original 22.12 floor was still
  too low; see *After the plan*.

Decisions:
- **The PR body is a file, not an open PR.** Pushing and opening the PR need explicit
  approval, and `gh` is not installed here. `docs/PULL_REQUEST.md` is written to be pasted
  into GitHub unchanged.
- **No screenshots were committed.** The browser capture tool needs a visible desktop
  window, so the PR document lists the four captures to take instead of shipping stale or
  broken images.
- **The plan was not rewritten to match the code.** The MSW → `vi.mock` deviation is
  recorded in `DECISIONS.md`; editing the plan after the fact would hide the reasoning.
- **Step 6 is marked done but the PR is not open.** The acceptance bullet is left as
  written so the remaining action is visible rather than quietly satisfied.

---

## After the plan — CI ✅

### Goal
Catch regressions before merge, with a check that is fast and deterministic.

### What was added
- `.github/workflows/ci.yml` — one `verify` job: checkout, Node 22.22.2 with the npm cache,
  `npm ci`, then typecheck, test and build as separate steps. Triggers on pull requests into
  `main`, pushes to `main`, and manual dispatch. Concurrency cancels superseded runs;
  permissions are read-only.

### Verification
- The workflow YAML parses and contains one job with the expected steps.
- `npm run typecheck`, `npm run test` (62 API + 11 web) and `npm run build` pass locally.
- The Docker path was already verified by hand in Step 5 and is unchanged by this addition.

### First run on GitHub — failure and fix

Pull request #1 triggered run `45018720951`. `Checkout`, `Set up Node`, `Install` and
`Typecheck` passed; `Test` failed and `Build` was skipped.

The API suite passed all 62 tests. The web suite could not start its worker:

```
Error: [vitest-pool]: Failed to start forks worker for src/App.test.tsx
Caused by: TypeError: Cannot read properties of undefined (reading 'bind')
  at undici/lib/interceptor/decompress.js:78
```

`jsdom@31` pulls in `undici@8`, which calls `zlib.createZstdDecompress.bind(...)` when its
module loads. That API does not exist in Node 22.12. Undici declares `node >=22.19.0` and
jsdom declares `^22.22.2 || ^24.15.0 || >=26.0.0`.

Reproduced locally by running Vitest with downloaded Node 22.12.0 — identical error — and
with Node 22.22.2, where all 11 web tests pass.

Fix: CI now uses Node 22.22.2, `engines.node` is `^22.22.2 || >=24.15.0`, and every
document that named 22.12 was corrected. The Step 6 "fix" of the Node mismatch aligned the
docs to 22.12, which was still the wrong floor; CI exposed it. Recorded in
`docs/AI_USAGE.md` section 6.3.

### Decisions
- **Three checks only.** Typecheck, test and build are the checks that catch what review
  misses, and they are fast, secret-free and deterministic. See `docs/DECISIONS.md`
  decision 19.
- **No Docker job in CI.** The Compose path is a one-command local check that was verified
  end to end in Step 5; putting it in CI would roughly double run time and introduce
  runner-specific Docker failures. It is a scope decision, revisitable in a few lines.
- **No Fake Store calls, no browser tests.** A green build must never depend on a third
  party's uptime.
- **Node is pinned to the minimum supported version**, not the latest, so the documented
  floor is the one actually tested.
- **One job, no version matrix.** Only Node 22.22.2+ and 24.15+ are supported, so a matrix
  would test runtimes nobody uses.

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
| `FEATURED_PER_CATEGORY` | 3 | Category split |
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
