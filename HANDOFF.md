# Handoff prompt: Mylapore Restaurant (paste into a new chat)

You are continuing work on an existing project. Read this fully, then inspect the code before changing anything. Do not rebuild what exists.

## 1. Project
Pure vegetarian restaurant website + backend: **Mylapore Restaurant**, Tiruchanoor Road, Tirupati, Andhra Pradesh, India. Channels: dine-in, takeaway, home delivery. Languages: English, Telugu, Tamil, Kannada, Hindi.
Location: `C:\Users\Administrator\veg-restaurant` (folders `frontend/`, `backend/`, plus `README.md`). No Docker (it was removed on request).

Original brief (still the long-term target): Next.js + NestJS + PostgreSQL (Prisma) + Socket.IO + Razorpay/Cashfree hosted checkout + Salesforce (CRM/ops, synced via transactional outbox) + the existing Agentforce Service Agent (extend, never rebuild). Rules from the brief: PostgreSQL is the system of record; unpaid online orders never reach the kitchen; only a signed webhook proves payment; do not invent menu items, prices, tax, hours, delivery radius or policies (mark as configurable); never assume a Salesforce object/endpoint exists. Only an MVP is built; the 17-section architecture document from the brief was NOT written.

## 2. Stack and how to run
- Frontend: Next.js 15.5 (App Router), React 19, TypeScript 5, plain CSS (`app/globals.css` + `app/app-ui.css`), Socket.IO client. Fonts: Fraunces + Inter.
- Backend: NestJS **11** (pinned; v12 is ESM-only and breaks), Prisma 6, PostgreSQL 16, Socket.IO, jsonwebtoken, helmet, throttler, Swagger at `/docs`.
- DB: the machine's own PostgreSQL 16 service on `localhost:5432`, database `vegrestaurant`, user/password `postgres`/`postgres`. A second DB `busyatra` belongs to the user's other project: never touch it, and never write to the default `postgres` DB.
- Run: `cd backend && npx prisma migrate deploy && npm run seed && npm run start:dev` (API on :4000, prefix `/api/v1`), then `cd frontend && npm run dev` (site on :3000). Production-style: `npx nest build && node dist/main.js` and `npx next build && npx next start -p 3000`.
- `backend/.env` holds: DATABASE_URL, STAFF_API_KEY=`change-me-staff-key`, PAYMENT_PROVIDER=`mock`, MOCK_WEBHOOK_SECRET=`mock-secret`, SERVICE_PINCODES=`517501,517502,517503`, TAX_PERCENT=0, DELIVERY_FEE_PAISE=0, COD_ENABLED=true, JWT_SECRET (dev value), GOOGLE_CLIENT_ID (empty), SALESFORCE_INBOUND_KEY. `frontend/.env.example` lists NEXT_PUBLIC_API_URL, NEXT_PUBLIC_WS_URL and optional social links.

## 3. What is built
**Backend** (`backend/src`): `menu` (public menu, config incl. service pincodes, staff price/availability patch, item detail with category), `orders` (server-side pricing in paise, availability + price-change checks (409 PRICE_CHANGED), delivery pincode check (422), Idempotency-Key, transactional create, guest tracking via secret lookupToken, optional link to signed-in user), `payments` (gateway interface, Razorpay payment-link adapter, mock gateway, trusted-host allow-list for checkout URLs, raw-body HMAC webhook, event-id dedupe, amount verification, late-payment => REFUND_REQUIRED, expiry job, dev-only mock completion), `kitchen` (staff API + Socket.IO rooms `order:<id>` and `kitchen`), `outbox` (retrying worker, FOR UPDATE SKIP LOCKED, backoff, dead-letter, Salesforce REST upsert by external ID; no-ops until credentials exist), `integrations` (Salesforce inbound status, Agentforce order-lookup with phone ownership check returning a structured `action: OPEN_CHECKOUT`), `reservations`, `auth` (register, password login with scrypt, Google ID-token exchange, one-time-code login, `/auth/me`, `/me/orders`). Rate limiting, helmet, CORS, validation pipes on.
**DB**: Prisma schema + 2 migrations (`init`, `accounts_and_item_details`). Seed = 8 categories, 22 demo dishes (`prisma/seed.ts` + `seed-extra.ts`).
**Frontend** (`frontend/app`, `components`, `lib`): Swiggy/Zomato-style UI from the user's reference screenshot, light + dark theme (toggle; `?theme=light|dark` override), terracotta/cream palette. Home (hero carousel, "What's on your mind?", rows, collections, CTA), restaurant-style Menu (sticky category index, dish rows, right-side filters: price sort, Vegetarian/Vegan/Jain, 3 tags, quick chips), dish pages `/menu/[slug]` (zoom, allergens, ingredients, nutrition placeholder, reviews 0), quick-view sheet, slide-over cart drawer, ADD pill that becomes a minus/qty/plus stepper, toasts, floating cart bar, mobile bottom nav, search with live suggestions, delivery-pincode modal, 3-step checkout with inline validation and sticky summary, order tracking timeline (socket + polling), My Orders, Sign in / Create account / Log in with a code / Continue with Google, kitchen kanban board (`/kitchen`, live indicator, timers, sound alert, cancel), reservations, About, Specialities, Gallery (lightbox), Contact, photo credits. PWA manifest + icons, sitemap, robots, JSON-LD, security headers, noindex on private pages, loading/error/404 pages. i18n via `lib/i18n.ts` (partial dictionaries fall back to English).

## 4. Verified state (last run)
- Backend: 11 Jest unit tests pass; `backend/test/e2e.mjs` (needs API running, ~65 s because of a rate-limit wait) covered pricing, idempotency, forged/duplicate webhooks, kitchen visibility, COD, auth, code login, ownership checks: all passed.
- Frontend: axe-core 0 violations on 13 pages (light and dark); Lighthouse accessibility 100, best practices 100, SEO 100; home desktop performance 98; mobile `/menu` ~74 (LCP ~4 s, remote image optimisation). Puppeteer suites (interaction 28 checks, flow 23 checks incl. live kitchen-to-customer updates) passed. Those test scripts live in the old session scratchpad and were not committed.
- Test data I created was deleted; one order + one reservation from a customer named "saa" (phone 9876543212) were left because they are probably the user's own.

## 5. Decisions and honesty rules to keep
- Never invent: prices, hours, tax, delivery fee, ratings, reviews, delivery times, discounts, nutrition values, phone/email/social links. Current prices are DEMO values; hours/phone show "to be announced"; testimonials were removed; reviews show 0.
- Ingredients, allergens, vegan/jain flags and spice levels in the seed are DRAFTS the kitchen must confirm (UI says so). Nutrition is intentionally empty.
- Images: Unsplash photos (hotlinked, checked as vegetarian) + 10 Wikimedia Commons photos stored in `frontend/public/menu/` with licence credits in `credits.json` and the `/credits` page. "Crispy Idli" and "Mini Tiffin" reuse idli/vada photos (no better match found).
- Google sign-in needs `GOOGLE_CLIENT_ID`; code login has no SMS/email provider (code is logged and returned as `devCode` outside production).
- Staff auth is a shared key (`x-staff-key`), an MVP shortcut.

## 6. Gotchas learned (save time)
- Bash heredocs containing apostrophes/`$$` often fail or trip the safety check: write files with the Write tool or Python script files instead.
- `prisma generate` fails (EPERM) while the API is running: stop the API first. `prisma migrate deploy` silently creates a missing database, so check `DATABASE_URL`.
- Embedded Postgres refuses to run as Administrator; use the installed service (psql is at `C:\Program Files\PostgreSQL\16\bin\psql.exe`, password `postgres`).
- Headless Edge defaults to dark mode; use `?theme=light`. Lighthouse intermittently fails with NO_NAVSTART under Edge.
- Edit/Write fails if a file changed since it was read: re-read first.

## 7. Open items / suggested next steps
1. Management inputs: real menu, prices, tax, delivery fee/pincodes, opening hours, phone/email/socials, restaurant policies, payment gateway choice (Razorpay vs Cashfree) and credentials.
2. Replace the staff key with JWT/RBAC (OTP login by mobile); add a real SMS/WhatsApp/email provider for codes and notifications.
3. Salesforce: create the custom order object (default `Web_Order__c` with `External_Id__c`), Connected App + Named Credentials, then the Agentforce action, and the website chat widget that opens `checkoutUrl` from the structured action. Add the reconciliation job and refunds API.
4. Scale/ops: Redis adapter for Socket.IO, BullMQ if needed, Testcontainers test suite, CI/CD, observability, backups, hosting in India, strict CSP.
5. Performance: self-host or CDN the dish images; translate the sign-in pages and long paragraphs; commit the browser test scripts (Puppeteer) as a proper test suite.
6. Write the architecture/OpenAPI/roadmap document from the original brief if still wanted (OpenAPI JSON is auto-served at `/docs/openapi.json`).

## 8. How the user likes to work
Wants working code built and run (not just documents), enterprise-level UI/UX in the style of Swiggy/Zomato, honest limitations, and the backend/APIs left intact when only the UI is being changed. Asked for a critical "reviewer" pass on the UI. Prefers short, plain summaries of what changed and what is still open.

## 9. Salesforce / Agentforce integration (added 2026-11-11)
- **New backend module** `backend/src/agent/` exposes `/api/v1/agent/*` for Salesforce (config, menu, categories, items, item details, orders create/details/status/cancel, reservations create/details/cancel). Auth: header `x-api-key` = `AGENT_API_KEY` (set in `backend/.env`; fails closed when unset). It wraps existing order/reservation logic; no business rules were duplicated. Existing public APIs are unchanged.
- **Small changes to existing services** (needed because they were missing): `OrdersService.findOwned / cancellability / cancelByCustomer / checkoutUrlFor`, and `ReservationsService` is now exported with `findOwned / cancelByCustomer`. Customer cancellation is allowed only while an order is `PENDING_PAYMENT` or `CONFIRMED`; a cancelled paid online order is flagged `REFUND_REQUIRED` (no refund API).
- **Tests:** `node backend/test/agent-api.e2e.mjs` (52 checks, API must be running). The older `test/e2e.mjs` and the 11 Jest tests still pass.
- **New separate project:** `C:\Users\Administrator\mylapore-salesforce` (Salesforce DX, API 68.0): Apex service + 12 Agentforce actions + 17 Apex-defined types + LWC controllers, the `restaurantOrdering` LWC (+ children), 7 Lightning Type renderers, Named/External Credential, permission set. 63 LWC tests + ESLint pass. **Not deployed to any org and Apex not compiled in an org yet.** Read its `README.md` and `docs/` (SETUP, API_CONTRACT, LIGHTNING_TYPES, AGENTFORCE_BUILDER_PROMPT).
- **Needs a public HTTPS URL** for the backend (Salesforce cannot call localhost). Use `node scripts/configure-endpoint.mjs https://host` in the Salesforce project.
- Known gaps: the menu has no subcategories and no structured customization options (types/LWC support them when the backend does); ingredients/allergens are drafts; refunds are manual.
- Gotcha: in Apex, `override` is a reserved word (cost me a compile error in the test mock: renamed to `stub`).
- **Deployed 2026-11-11 to the `YatraBus` org** (alias in the Salesforce CLI; Developer Edition): 40 Apex classes, 15 LWCs, 7 Lightning Types, Named + External Credential `Restaurant_API`, permission set `Restaurant_API_Access`. Validated with a check-only deploy first; 36 Apex tests pass. **Still manual there:** (1) Named Credential URL is a placeholder: run `node scripts/configure-endpoint.mjs https://<public host>` then redeploy it; (2) add the `ApiKey` secret (= backend `AGENT_API_KEY`) to the External Credential principal in Setup; (3) assign `Restaurant_API_Access` to the running user and the agent user (not done yet; a smoke callout confirmed it is required); (4) CSP trusted site for images was NOT deployed.
- Org-taught gotchas: `currency` is a reserved Apex identifier (types use `currencyCode`); an External Credential `AuthHeader` must not set its own parameterGroup; a renderer's `sourceType` is `c__<LightningType bundle name>`, not the Apex class; a local Apex parser is not a compiler: always run a check-only deploy.
