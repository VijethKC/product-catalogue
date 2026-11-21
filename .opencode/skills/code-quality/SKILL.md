---
name: Code Quality & Standards
description: Apply this project's engineering standards, best practices, and review checklist when writing or reviewing TypeScript, React, Express, or test code in this repository.
---

# Code Quality & Standards

Use this skill before implementing a feature, after generating code, and during
self-review. It encodes the standards for this repository. When a rule here
conflicts with an explicit user instruction, follow the user and note the
deviation.

## When to use

- Writing or modifying any TypeScript file.
- Adding an API route, service, adapter, or React component.
- Adding or changing tests.
- Reviewing AI-generated code before declaring a task complete.

## Non-negotiables

1. **Type safety first.** `strict` is on. No `any`, no `as` casts to silence
   errors, no non-null `!` unless the invariant is proven on the previous line.
   Prefer `unknown` + narrowing or a Zod parse at boundaries.
2. **One contract.** Request/response shapes live in `packages/shared` and are
   imported by both apps. Never duplicate a type or re-declare a payload in the
   web app.
3. **Validate at the edge.** Every external input (HTTP body, query params,
   upstream API response, env vars) is parsed with Zod before use. Do not trust
   `req.body` or `fetch().json()`.
4. **Errors are explicit.** Throw `HttpError(status, code, message)` for expected
   failures; let the central handler map unknown errors to `500`. Never leak
   stack traces, SQL, or upstream payloads to the client.
5. **No secrets in code.** Configuration comes from env vars; `.env.example` is
   the only committed env file. Never log credentials, tokens, or full PII.
6. **Tests ship with the change.** A feature without a test for its acceptance
   criterion is not done. Bug fixes get a regression test.
7. **Small, reviewable increments.** One concern per commit. Do not refactor
   unrelated files while implementing a feature.

## TypeScript standards

- Explicit return types on exported functions.
- Prefer `type` for data shapes, `interface` only for extendable contracts.
- Use discriminated unions for state (`{ status: "idle" | "loading" | "error" | "success" }`)
  instead of parallel booleans.
- Avoid enums; use `as const` objects or unions.
- Handle `noUncheckedIndexedAccess`: check array access before use.
- No default exports except React page/component files that the router imports.

## Backend standards (Express)

- `app.ts` exports a `createApp()` factory so tests can mount the app without a
  listening socket. `index.ts` only boots the server.
- Layering is strict: `routes → services → repositories/adapters`. Routes do not
  fetch, services do not touch `req`/`res`.
- Async route handlers must forward rejections to the error middleware; never
  leave an unhandled promise.
- Return the shared response types; keep the error envelope identical everywhere.
- Upstream calls have a timeout and map failures to `502 UPSTREAM_UNAVAILABLE`.
- Email sending is behind `EmailProvider`; never import Nodemailer in a route or
  service.
- Log identifiers and outcomes, not message bodies or personal data.

## Frontend standards (React)

- Server state belongs to TanStack Query; do not copy fetched data into
  `useState`. Local UI state only for form input, modals, and toggles.
- Every query has explicit loading, empty, and error states. No blank screens.
- Keep components presentational where possible; put data access in hooks.
- Accessible by default: semantic elements, labelled inputs, `aria-live` for
  async feedback, visible focus rings, keyboard-operable controls.
- Never call the Fake Store API from the browser. All data goes through `/api`.
- Handle the enquiry form's pending state; disable double submits.
- No inline styles; use Tailwind tokens/utilities consistently.

## Testing standards

- Test behaviour, not implementation details.
- API: Supertest against `createApp()`; stub the network with `nock`; inject a
  fake `EmailProvider` instead of sending mail.
- Web: React Testing Library; assert what the user sees (`getByRole`,
  `getByLabelText`), not class names or internal state.
- Cover the failure path as well as the happy path.
- Tests must be deterministic: no real network, no sleeps, no shared mutable
  state between tests.
- Keep fixtures minimal and typed from `packages/shared`.

## Security and robustness

- Validate and cap payload sizes (body limit already 32kb).
- Escape any user-provided text interpolated into HTML email.
- Do not echo raw upstream errors; log server-side, return a stable code.
- Treat `FEATURED_PRODUCT_IDS` and other config as untrusted input and validate.
- Add a honeypot or rate limit to public write endpoints if time permits; note
  the decision if omitted.

## Definition of done (run before reporting complete)

```bash
npm run typecheck
npm run test
npm run build
```

Also confirm:

- [ ] New behaviour has a test that fails without the change.
- [ ] Shared schemas updated if the API shape changed.
- [ ] No new dependency unless justified in the response.
- [ ] No `console.log` left in application code (startup logs excepted).
- [ ] Error and empty states handled in the UI.
- [ ] Diff contains only files related to the task.

## Anti-patterns to reject

- `any`, `@ts-ignore`, or `eslint-disable` added to make an error disappear.
- Business logic inside route handlers or React components.
- Duplicated request/response types between web and API.
- Catching an error and returning `200` with an empty body.
- Tests that assert implementation details or depend on network access.
- Copy-pasting a second HTTP client instead of reusing `src/api/client.ts`.
- Adding a library for something the platform already provides.

## Review output format

When reviewing generated code, report findings in this order:

1. **Blocking** — correctness, security, contract drift, missing tests.
2. **Should fix** — layering violations, error handling gaps, accessibility.
3. **Nit** — naming, formatting, minor duplication.

State file and line for each finding, and explain the risk rather than only the
fix. Do not rewrite unrelated code during review.
