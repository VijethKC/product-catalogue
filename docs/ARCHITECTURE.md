# Architecture Walkthrough

> High-level guide to how the code fits together: the monorepo, the request flow,
> what each file does, and why the configuration exists.
> Companion to [`PLAN.md`](./PLAN.md) and [`IMPLEMENTATION_STEPS.md`](./IMPLEMENTATION_STEPS.md).
> Last updated: 2026-11-22

---

## 1. The big picture

Three packages, two runtimes, one contract:

```
packages/shared  ── Zod schemas + TypeScript types (the contract)
       ▲                    ▲
       │                    │
   apps/api             apps/web
 (Node/Express)       (React/Vite)
       │
       ▼
  Fake Store API
```

- **Monorepo (npm workspaces)** gives one `npm install`, one set of scripts, and one
  place to define the API contract. Both apps import `@catalogue/shared`; neither
  duplicates types.
- **API** owns all business rules and is the only thing that talks to Fake Store.
- **Web** is a pure client of `/api`.

---

## 2. Dev runtime topology

`npm run dev` starts two processes via `concurrently`:

```
Browser ──► http://localhost:5173  (Vite dev server)
              │
              ├── /            → index.html → src/main.tsx → App
              └── /api/*       → proxy ──► http://localhost:4000 (Express)
                                              │
                                              └──► https://fakestoreapi.com
```

The proxy is why there is no CORS configuration: the browser only ever sees one
origin (`5173`). In production (Step 5), nginx plays the same role on port 8080.

---

## 3. End-to-end request flow

Example: `GET /api/products?category=electronics`

1. **Browser** calls `http://localhost:5173/api/products?category=electronics`.
2. **Vite** matches `/api` and proxies to
   `http://localhost:4000/api/products?category=electronics`.
3. **Express middleware chain** in `app.ts`, in order:
   - `helmet()` — security headers
   - `express.json()` — body parsing (global; irrelevant for GET)
   - route match → `productsRouter`
4. **Router** (`routes/products.ts`):
   - parses the query with `productQuerySchema`
   - invalid input throws `HttpError(400, "VALIDATION_ERROR")`
5. **`asyncHandler`** wraps the handler. Express 4 does not catch async rejections,
   so it does `.catch(next)`.
6. **Service** (`services/productService.ts`):
   - asks the repository for all products
   - filters by category/search
   - applies `limit`, computes `total`
7. **Repository** (`repositories/fakeStoreAdapter.ts`):
   - builds `https://fakestoreapi.com/products`
   - `fetch` with `AbortSignal.timeout(5000)`
   - validates the payload with `z.array(productSchema)`
   - maps failures to `502`
8. **Response** flows back as `{ products, total }`.

### Error path

```
handler throws HttpError
        │
        ▼
asyncHandler .catch(next) ──► errorHandler
                                  ├── HttpError → its status/code/message
                                  └── anything else → 500 INTERNAL_ERROR
```

Unmatched routes hit `notFoundHandler` → `404 NOT_FOUND`. The same envelope is
used everywhere.

### Enquiry flow

```
EnquiryForm → POST /api/enquiries
  → enquirySchema.safeParse        invalid → 400 VALIDATION_ERROR (+ field details)
  → enquiryService.create
      → productRepository.getById  missing → 404 PRODUCT_NOT_FOUND
      → emailProvider.send         throws  → 502 EMAIL_UNAVAILABLE
  → 201 { id: "enq_<uuid>", message }
```

The service only reports success after `send` resolves. The SMTP implementation builds a
multipart message, escapes every value in the HTML part, and strips CR/LF from the subject.

---

## 4. File map

### Root

| File | Role | Why |
|---|---|---|
| `package.json` | Workspace list + shared scripts | Single entry point; `--workspaces --if-present` runs each app's script |
| `tsconfig.base.json` | Shared compiler rules | `strict`, `noUncheckedIndexedAccess`, `noEmit` — one standard for all packages |
| `.env.example` | Documented config, no secrets | Reviewers copy to `.env`; secrets never committed |
| `.gitignore` | Ignores `node_modules`, `dist`, `.env` | Keeps build output and secrets out of git |
| `AGENTS.md` | Agent working rules | Discipline for AI-assisted delivery |
| `docs/PLAN.md` | Architecture and decisions | Reference for the challenge |
| `docs/IMPLEMENTATION_STEPS.md` | Step-by-step log | What was done and how to verify |
| `docs/DECISIONS.md` | Decision records with alternatives and costs | Why the code looks like this |
| `docs/AI_USAGE.md` | AI workflow, review process, real mistakes | How the work was delivered |
| `docs/PULL_REQUEST.md` | PR description and AC mapping | Reviewer entry point |
| `docker-compose.yml` | `mailpit`, `api`, `web` | One command for the reviewer path |
| `.dockerignore` | Build-context exclusions | Small context, no secrets or build output |
| `.github/workflows/ci.yml` | `verify` job | Typecheck, tests and builds on every PR |

### `packages/shared`

| File | Role |
|---|---|
| `src/index.ts` | `productSchema`, `productQuerySchema`, `enquirySchema`, and response types (`ProductListResponse`, `CategoryProducts`, `CategoriesResponse`, `ApiErrorBody`) |
| `package.json` | Points `main`/`types` directly at `src/index.ts` — no build step needed |

**Why TypeScript source as the entry:** the API bundles it with tsup (`noExternal`),
and Vite compiles it as part of the web build. One source of truth, no publish or
build overhead.

### `apps/api`

| File | Role |
|---|---|
| `src/index.ts` | Boots the server. Loads `dotenv/config` first, then app/config |
| `src/app.ts` | `createApp()` factory: middleware, DI, routes, error handlers. No `listen()` — testable |
| `src/config.ts` | Parses env once with Zod, fails fast, converts `FEATURED_PRODUCT_IDS` to `number[]` |
| `src/errors.ts` | `HttpError` — status + code + optional details |
| `src/middleware/errorHandler.ts` | 404 handler + central error mapping (including malformed JSON) |
| `src/middleware/asyncHandler.ts` | Forwards async rejections to Express |
| `src/repositories/productRepository.ts` | The seam: `getAll`, `getById` |
| `src/repositories/fakeStoreAdapter.ts` | Fake Store HTTP + validation + 502 mapping |
| `src/repositories/fixtureAdapter.ts` | In-memory repo for tests/offline |
| `src/services/productService.ts` | Product business rules; no Express types |
| `src/services/enquiryService.ts` | Product check, id generation, send, 502 mapping |
| `src/email/emailProvider.ts` | `EmailProvider` seam and `EnquiryEmail` shape |
| `src/email/smtpProvider.ts` | Nodemailer transport, message builder, HTML escaping |
| `src/routes/products.ts` | `/`, `/featured`, `/:id` |
| `src/routes/categories.ts` | `/`, `/:category` |
| `src/routes/enquiries.ts` | `POST /` with shared-schema validation |
| `Dockerfile` | Multi-stage build, production-only deps, non-root, healthcheck |
| `tests/*` | Service unit tests, adapter tests (nock), route tests (supertest + fixtures) |

**Why this layering:** routes handle HTTP, services hold rules, adapters handle I/O.
Replacing Fake Store with a database means writing one new adapter — nothing else
changes. Email follows the same pattern: swapping SMTP for a transactional API means
one new `EmailProvider`.

**Why dependency injection in `createApp`:** tests inject `fixtureAdapter` and never
touch the network. Production builds the adapter from config.

### `apps/web`

| File | Role |
|---|---|
| `index.html` | HTML shell, mounts `#root` |
| `src/main.tsx` | React root, QueryClientProvider, BrowserRouter, Tailwind import |
| `src/App.tsx` | Route table wrapped in `Layout` |
| `src/api/client.ts` | Typed fetch wrapper, query strings, error-envelope parsing |
| `src/hooks/useCatalogue.ts` | React Query hooks for products, categories, enquiry |
| `src/components/*` | Layout, header/search/nav, cards/grid, rating, price, form, states |
| `src/pages/*` | Home, Category, Search, Product detail, 404 |
| `src/test/render.tsx` | Providers + MemoryRouter test helper |
| `src/index.css` | Tailwind directives |
| `vite.config.ts` | React plugin, port 5173, `/api` proxy, Vitest jsdom config |
| `nginx.conf` | SPA fallback, `/api` proxy to `api:4000`, asset caching |
| `Dockerfile` | Vite build stage + nginx runtime |

The web app consumes only `/api`. It never calls Fake Store directly. The enquiry form is
wired to `POST /api/enquiries`, which is implemented in Step 3.

---

## 5. Configuration files and why

| File | What it does | Why it matters |
|---|---|---|
| `vite.config.ts` | Dev server, proxy, Vitest environment | One origin in dev; tests run in jsdom |
| `vitest.config.ts` (api) | Node environment, `tests/**/*.test.ts` | Fast API tests without a browser |
| `tsup.config.ts` | Bundles API to ESM for Node 20, bundles `@catalogue/shared` | Produces `dist/index.js` for `npm start`/Docker |
| `tailwind.config.js` | Content globs over `index.html` + `src` | Only ships used utility classes |
| `postcss.config.js` | Tailwind + autoprefixer | Processes CSS at build time |
| `apps/api/tsconfig.json` | Adds Node types, includes tests | API code + tests type-check together |
| `apps/web/tsconfig.json` | DOM libs, `react-jsx`, Vite client types | Browser + JSX support |
| `packages/shared/tsconfig.json` | Just `src` | Contract package has no runtime code beyond Zod |

### Why `"type": "module"` everywhere

All packages are ESM. `tsx` runs the API's TypeScript directly in dev; `tsup` emits
ESM for production; Vite is ESM-native. No CommonJS interop surprises.

---

## 6. Dev vs production builds

**Dev**

```
tsx watch src/index.ts   → runs TS directly, restarts on change
vite                     → serves modules on demand, HMR
```

**Build**

```
tsup       → dist/index.js                    (API bundle)
vite build → dist/index.html + dist/assets    (static web)
```

**Production (docker compose)**

```
Browser :8080 → nginx (web container)
                  ├── /        → static SPA from the Vite build
                  └── /api/*   → api:4000 (Express)
api :4000     → node apps/api/dist/index.js
mailpit :8025 → captures enquiry emails sent to mailpit:1025
```

Both images build from the repository root because npm workspaces need the root lockfile.
The API image installs production dependencies for the API workspace only; the web image
builds the SPA and copies `dist` into nginx.

---

## 7. Decisions visible in the code

| Decision | Where it shows up |
|---|---|
| Fake Store is replaceable | `ProductRepository` + `FakeStoreAdapter` |
| Frontend never calls upstream | Adapter lives only in the API |
| One contract | `packages/shared` imported by both apps |
| Validate every boundary | Query in router, upstream payload in adapter, env in config |
| Curated featured IDs | `FEATURED_PRODUCT_IDS` in config → service |
| Category top-3 rule | `FEATURED_PER_CATEGORY` → service split |
| Testable HTTP layer | `createApp()` factory + DI |
| No CORS | Vite proxy now, nginx later |
| No cache yet | Deliberate; optional per plan |

---

## 8. Where the remaining steps plug in

- **Step 4 (done):** router, API client, React Query hooks, pages and components. They
  consume the existing endpoints; the API did not change.
- **Step 3 (done):** `EmailProvider` + SMTP implementation, `enquiryService`,
  `routes/enquiries.ts`, and `POST /api/enquiries`. `createApp` takes an optional
  `emailProvider` the same way it takes `productRepository`, so tests inject a fake and
  production builds SMTP from config. This activated the enquiry form's submit path.
- **Step 5 (done):** Dockerfiles + nginx + compose + Mailpit. nginx takes over the proxy
  role on port 8080, and Mailpit captures enquiry emails locally.
- **Step 6 (done):** `README`, `DECISIONS`, `AI_USAGE`, and a paste-ready PR description in
  `docs/PULL_REQUEST.md`.
- **After the plan (done):** CI in `.github/workflows/`. `verify` installs, typechecks, tests
  and builds both workspaces on the minimum Node version. Docker and browser behaviour stay
  manual checks; the Compose path is a scope decision, not a technical limit.
