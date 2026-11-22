# Pull request: Product Catalogue

> Paste this into GitHub when opening the PR from `feat/product-catalogue` into `main`.
> The branch is not pushed yet, and `gh` is not installed on the authoring machine, so the
> PR itself is opened by hand.

**Title:** Product catalogue: browse, search, enquiry email, and a one-command Docker stack

---

## Summary

A React + TypeScript client and an Express + TypeScript API over the Fake Store API, with
enquiry emails delivered through a replaceable provider.

The browser never calls Fake Store directly. Every product request goes through our API,
which validates upstream data, applies the business rules, and returns one consistent
contract. Enquiries are validated, emailed to the sales inbox, and confirmed — or fail
loudly with a `502` and a retry state, never a false success.

Built in seven reviewable steps, each with its own tests and verification.

---

## What is included

| Area | Change |
|---|---|
| API | `GET /api/products`, `/featured`, `/:id`, `/api/categories`, `/:category`, `POST /api/enquiries`, `/api/health` |
| Seams | `ProductRepository` (Fake Store + fixtures), `EmailProvider` (SMTP/Mailpit) |
| Contract | `packages/shared` Zod schemas imported by both apps |
| Web | Home, Category, Search, Detail, 404; layout, cards, rating, price, states, enquiry form |
| Email | Nodemailer transport, HTML escaping, header-injection stripping, bounded timeouts |
| Infra | Multi-stage API and web images, nginx SPA + `/api` proxy, Compose with Mailpit |
| Docs | `README`, `ARCHITECTURE`, `DECISIONS`, `AI_USAGE`, `IMPLEMENTATION_STEPS`, `UI_DESIGN` |

---

## Acceptance criteria → implementation → test

### The five user-facing capabilities

| Requirement | Implementation | Test |
|---|---|---|
| **Home** shows exactly the five configured top-rated products | `FEATURED_PRODUCT_IDS` in `config.ts` → `productService.getFeatured()` → `HomePage` | `productService.test.ts`, `products.test.ts`, `App.test.tsx` |
| **Category** shows top-rated first, then the rest | `productService.getCategoryProducts()`, sorted by `rating.rate` → `rating.count` → `id`, split at `FEATURED_PER_CATEGORY` → `CategoryPage` | `productService.test.ts`, `categories.test.ts`, `App.test.tsx` |
| **Search** matches title, description and category | `productQuerySchema.q` → `productService.list()` → `SearchPage` | `productService.test.ts`, `products.test.ts`, `App.test.tsx` |
| **Detail** shows full information and an enquiry action | `GET /api/products/:id` → `ProductDetailPage` + `EnquiryForm` | `products.test.ts`, `App.test.tsx` |
| **Enquiry** validates, emails the inbox, confirms | `enquirySchema` → `enquiryService` → `EmailProvider.send` → `201` → thank-you state | `enquiry.test.ts`, `email.test.ts`, `App.test.tsx` |

### Cross-cutting requirements

| Requirement | Implementation | Test / evidence |
|---|---|---|
| Browser never calls Fake Store directly | The only network code in `apps/web` is `api/client.ts`, which calls `/api/…` | Code review; no `fakestoreapi` reference outside `apps/api` |
| Upstream data is validated | `FakeStoreAdapter` parses every response with `productSchema` | `fakeStoreAdapter.test.ts` (malformed payload → `502`) |
| Consistent error envelope | `HttpError` + `middleware/errorHandler.ts` | Route tests assert `{ error: { code, message, details? } }` |
| Invalid input is a client error | Zod validation in routes; malformed JSON mapped to `400` | `products.test.ts`, `enquiry.test.ts` |
| Delivery failure is never success | `send` rejection → `502 EMAIL_UNAVAILABLE`, logged | `enquiry.test.ts` |
| User input cannot inject HTML or headers | `escapeHtml`, CR/LF stripped from the subject | `email.test.ts` |
| Reviewer runs it in two commands | `cp .env.example .env && docker compose up --build` | Manual: all services healthy, enquiry in Mailpit |
| Quality gates pass | `npm run typecheck && npm run test && npm run build` | 62 API + 11 web tests |

---

## How to verify

### Docker (primary path)

```bash
cp .env.example .env
docker compose up --build
```

- App: http://localhost:8080
- Mailpit: http://localhost:8025
- API health: http://localhost:4000/api/health

Open any product, submit the enquiry form, then check Mailpit. The message arrives with a
plain-text and an HTML part; the HTML part escapes submitted values.

### Local development

```bash
cp .env.example .env
npm install
docker compose up mailpit   # SMTP on :1025
npm run dev                 # API :4000, web :5173
```

### Checks run on this branch

```
typecheck   ✅  api + web
tests       ✅  62 API + 11 web
build       ✅  api 15.99 KB, web 121.42 KB gzipped
compose     ✅  api, web, mailpit all healthy
```

End-to-end, through nginx on `:8080`:

| Request | Result |
|---|---|
| `GET /` and `GET /products/4` | `200` — SPA shell and client route |
| `GET /api/health` | `200 {"status":"ok"}` |
| `GET /api/products/featured` | `5` products, ids `1,2,3,4,5` |
| `POST /api/enquiries` (valid) | `201` with `enq_<uuid>` |
| `POST /api/enquiries` (unknown product) | `404 PRODUCT_NOT_FOUND` |
| `POST /api/enquiries` (invalid payload) | `400` with field details |
| `POST /api/enquiries` (malformed JSON) | `400 VALIDATION_ERROR` |
| Enquiry in Mailpit | present, HTML escaped, newline rendered as `<br>` |
| API container user | `uid=1000(node)`, not root |

---

## Screenshots

Not committed as binary files. Capture these four and drag them into the PR description:

| # | Page | Suggested filename |
|---|---|---|
| 1 | Home — five featured products | `01-home.png` |
| 2 | Category — top-rated section, then the rest | `02-category.png` |
| 3 | Detail — product plus enquiry form | `03-detail.png` |
| 4 | Mailpit — the captured enquiry | `04-mailpit.png` |

Optional: the enquiry form's success state and its `502` retry state.

---

## Assumptions

Documented in full in [`docs/DECISIONS.md`](DECISIONS.md).

1. **"Top rated" per category means the top three** — sorted by `rating.rate`, then
   `rating.count`, then `id`. Configurable via `FEATURED_PER_CATEGORY`.
2. **Featured products are curated**, not computed: `FEATURED_PRODUCT_IDS` (default
   `1,2,3,4,5`).
3. **Search uses `q`**, and matches title, description and category, case-insensitively.
4. **`GET /api/categories/:category` returns a split** (`topRated` + `additional`) rather
   than a flat list, so the ordering rule lives on the server.
5. **An enquiry about a missing product is a `404`**, not a `400` — the payload is valid,
   the resource is not.
6. **Mailpit captures email locally**; it does not deliver to a real inbox. Production is a
   `SMTP_*` configuration swap, not a code change.
7. **No persistence.** The email is the record.
8. **Node 22.22.2+** (or 24.15+), matching `engines` and the container image.

---

## Explicitly out of scope

Authentication, cart, checkout, payments, admin, database, i18n, multi-currency, cloud
deployment, rate limiting, and caching. Each is listed with its reasoning in
[`docs/DECISIONS.md`](DECISIONS.md) rather than half-implemented.

---

## Review checklist

- [x] Every acceptance criterion maps to code and a test
- [x] `npm run typecheck`, `npm run test`, `npm run build` pass
- [x] `docker compose up --build` works from a clean clone
- [x] Enquiry appears in Mailpit; the UI shows the thank-you state
- [x] No secrets committed; `.env` is gitignored, `.env.example` documents every variable
- [x] No unrelated files changed
- [x] Decisions and assumptions written down, including one deviation from the original plan
