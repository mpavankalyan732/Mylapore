# Pure Veg Restaurant: Website + API

Next.js 15 (App Router, TypeScript) frontend and NestJS 11 + Prisma 6 + PostgreSQL backend, Socket.IO realtime, transactional outbox for Salesforce sync.

```
frontend/   Next.js site: home, menu (5 languages), cart/checkout, order tracking, reservations, kitchen dashboard
backend/    NestJS API (OpenAPI at /docs), Prisma schema + migration + seed
```

## Run locally

```bash
# requires a local PostgreSQL 14+ (create a database named vegrestaurant)
cd backend
cp .env.example .env                     # adjust DATABASE_URL if needed
npm install
npx prisma migrate deploy && npm run seed
npm run start:dev                        # API on :4000, docs at http://localhost:4000/docs

cd ../frontend
cp .env.example .env.local
npm install && npm run dev               # http://localhost:3000
```

Kitchen dashboard: `/kitchen` (staff key = `STAFF_API_KEY`, default `change-me-staff-key`).
Demo payment: `PAYMENT_PROVIDER=mock` shows a fake hosted checkout at `/pay/mock`. It still goes through the signed-webhook path.

## Accounts, filters, themes
- Sign in / create account: email or phone + password, "Log in with a code", and Continue with Google. Endpoints: `/auth/register`, `/auth/login`, `/auth/code/request|verify`, `/auth/google`, `/auth/me`, `/me/orders`. Guest checkout still works.
- Google needs `GOOGLE_CLIENT_ID` in `backend/.env` (until then the button explains it is inactive). Code login has no SMS/email provider yet: the code is logged by the server and shown on screen outside production.
- Menu filters (right side): sort by price, dietary (vegetarian/vegan/jain) and tags. Item pages show ingredients, allergens and reviews. Ingredients/allergens/dietary values in the seed are DRAFTS for the kitchen to confirm; nutrition is empty on purpose.
- Light/dark theme toggle in the header (`?theme=light|dark` also works).

## Quality bar (last audit)
- Accessibility: axe-core (WCAG 2.1 A/AA + best practices) reports 0 violations on 13 pages, light and dark. Lighthouse: accessibility 100, best practices 100, SEO 100.
- Performance (production build): home 98 on desktop (LCP 1.1s, CLS 0). Mobile `/menu` scored ~74 on Lighthouse's throttled profile (LCP ~4s): the first load of remote dish photos goes through Next image optimisation. Self-hosting or a CDN for images fixes this at deployment.
- Checkout, kitchen board, live order tracking and the five-language UI are covered by browser tests (Puppeteer); the scripts are not committed.
- SEO/PWA: sitemap.xml, robots.txt, web manifest + icons, JSON-LD for the restaurant and every dish, noindex on private pages. Security headers set in `next.config.mjs` (a strict CSP is still to do).

## Tests
- `cd backend && npm test`: 11 unit tests (pricing, state machine, URL allow-list, HMAC, webhook handler incl. duplicate/invalid signature/amount mismatch/late payment).
- `node backend/test/e2e.mjs` (API running): 36 end-to-end checks covering the required scenarios.

## Payment flow (implemented)
1. `POST /orders` (Idempotency-Key header) prices on the server and creates the order `PENDING_PAYMENT` in a transaction.
2. Gateway checkout is created; the URL is validated against `TRUSTED_CHECKOUT_HOSTS` and returned as `checkoutUrl`.
3. The return page only shows "processing". Only a signed webhook (raw-body HMAC, deduped by event id, amount verified) moves the order to `CONFIRMED`.
4. Unpaid orders never appear in `/kitchen/orders` and never reach the kitchen socket room. COD is a separate path (`COD_ENABLED`).
5. Payment arriving after expiry/failure is flagged `REFUND_REQUIRED` and never confirms the order.

## Salesforce / Agentforce
- Outbox worker upserts orders by external ID (`Web_Order__c.External_Id__c`, configurable). It no-ops until `SALESFORCE_CLIENT_ID/SECRET` are set. Retries use exponential backoff, then `DEAD`.
- `POST /integrations/salesforce/order-status` (header `x-integration-key`): kitchen status from Salesforce back to Postgres and WebSocket clients.
- `POST /integrations/agentforce/order-lookup`: ownership check by verified phone; returns structured `{status, checkoutUrl, action:{type:'OPEN_CHECKOUT'}}`. The chat widget must open `action.url` itself; chat text never redirects.
- Nothing is assumed to exist in Salesforce: create the custom object, Connected App and Named Credential first.

## Placeholders to confirm with management
Menu items and prices (seed is DEMO data), restaurant name (`NEXT_PUBLIC_RESTAURANT_NAME`), tax % (`TAX_PERCENT`), delivery fee and pincodes (`SERVICE_PINCODES`), opening hours, COD policy, gateway choice and credentials.

## Not built yet (roadmap)
OTP login + JWT/RBAC (staff currently use a shared key), Redis adapter for multi-instance sockets, BullMQ, refunds API, reconciliation job, Agentforce chat widget, catering/loyalty, Testcontainers suite, CI/CD, observability.
Cost dependencies: Razorpay/Cashfree fees, SMS/WhatsApp provider, Salesforce licences, India hosting (e.g. AWS Mumbai / Azure Central India).
    