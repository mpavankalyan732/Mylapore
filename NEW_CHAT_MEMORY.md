# Memory prompt: paste this at the start of a new chat

You are continuing work on the **Mylapore Restaurant** project. Read this fully, then read `C:\Users\Administrator\veg-restaurant\HANDOFF.md` for detail. Do not re-derive what is listed as done.

## 1. Projects and locations
- `C:\Users\Administrator\veg-restaurant\frontend`: Next.js 15 (App Router, React 19, TS), plain CSS, 5 languages, light/dark theme, accounts, filters, cart drawer, item pages.
- `C:\Users\Administrator\veg-restaurant\backend`: NestJS 11 (pinned, v12 is ESM-only), Prisma 6, PostgreSQL 16 (local DB `vegrestaurant`, user/pass postgres/postgres), Socket.IO, JWT + scrypt, outbox for Salesforce sync, mock/Razorpay payments (signed webhook), idempotency keys. No Docker (removed on request).
- Salesforce API for Agentforce: `/api/v1/agent/*` (x-api-key guard `AGENT_API_KEY`, fails closed if unset).
- `C:\Users\Administrator\mylapore-salesforce`: Salesforce DX project (API 68.0): 40 Apex classes (12 invocable actions, 17 types, `RestaurantApiService` is the only callout class, uses `callout:Restaurant_API`), 15 LWCs (ordering UI + 7 Agentforce renderers), 7 Lightning Types, Named Credential + External Credential `Restaurant_API`, permission set `Restaurant_API_Access`. `manifest/package.xml` covers ApexClass, LightningComponentBundle, LightningTypeBundle. No custom Salesforce objects; PostgreSQL is the source of truth.
- Docs: `mylapore-salesforce/docs/` (SETUP, API_CONTRACT, LIGHTNING_TYPES, AGENTFORCE_BUILDER_PROMPT), `veg-restaurant/HANDOFF.md`, `veg-restaurant/DEPLOY.md`, `veg-restaurant/render.yaml`.

## 2. History of requests (in order) and what was done
1. Build the veg restaurant site + API (Next.js + NestJS + Postgres + Salesforce-ready). Done.
2. Remove Docker from both folders. Done.
3. Site not reachable on localhost: fixed (run backend :4000, frontend :3000).
4. Restyle as Mylapore Restaurant, then Swiggy/Zomato enterprise-level UI: light/dark, sign-in/create account (email/phone+password, code login, Google), filters (price sort, vegetarian/vegan/jain, tags), item pages, cart fixes. Backend kept intact. Done; axe 0 violations, Lighthouse a11y/BP/SEO 100.
5. Handoff memory prompt (`HANDOFF.md`). Done.
6. Salesforce Agentforce integration: API for Apex, DX project with Apex/LWC/Lightning Types, a prompt for Claude in Chrome to build the agent (`AGENTFORCE_BUILDER_PROMPT.md`). Done. Tests: 11 backend unit, 52 agent-API e2e, 36 Apex, 63 LWC Jest.
7. Deployed Apex, LWC, Lightning Types, Named/External Credential and permission set to org alias **YatraBus** (65/65 components, 36 tests). Org-taught gotchas: `currency` is reserved in Apex (use `currencyCode`); AuthHeader needs no parameterGroup; renderer `sourceType` = Lightning Type bundle name (`c__restaurantMenu`); a local Apex parser is not a compiler.
8. Pushed `frontend/`, `backend/`, `render.yaml`, `DEPLOY.md` to https://github.com/mpavankalyan732/Mylapore (branch main, PUBLIC repo). Replaced the repo's placeholder README. Added a **sanitized** `backend/.env` (production URLs, all secrets blank) because the repo is public and the real file holds Salesforce client secret + agent key. The local `.env` is untouched. I did NOT deploy to Render (no access): the user must create the Blueprint in Render (New > Blueprint > this repo). Expected URLs: site `https://mylapore-web.onrender.com`, API `https://mylapore-api.onrender.com` (set in `render.yaml` and `.env.example` files). If Render names differ, update FRONTEND_URL/CORS_ORIGINS/PUBLIC_ASSET_URL on the API and NEXT_PUBLIC_API_URL (+`/api/v1`)/NEXT_PUBLIC_WS_URL on the site, then redeploy the site.
9. Latest: user shared screenshots of the agent (Mylapore_Restaurant_Assistant, Agent Script, Live Test) showing "unable to reach the restaurant menu system" and Developer Console logs `UNREACHABLE: GET /agent/menu`, and asked to audit/fix Lightning Types (7 tasks). Audit result: schemas, both-channel renderers, LWC targets/`@api value`/failure handling, Apex output fields and the agent script (`is_displayable: True`, `complex_data_type_name: c__restaurant…`) were all already correct. Re-deployed via `manifest/package.xml` (62/62, 36 tests, 0 failures). **Nothing was wrong with the cards; the menu fails because the callout cannot reach the API.** `__supports_result_display__: false` is just the failed result.

## 3. Current blocker and next steps (in order)
1. Deploy backend + frontend on Render (user action) and get the real URLs (health: `<API>/api/v1/health`; the Render URLs timed out when last checked, so they are not live).
2. In `mylapore-salesforce`: `node scripts/configure-endpoint.mjs https://<API host>` then deploy `NamedCredential:Restaurant_API`. (User said not to change Named Credentials/API keys/permission sets unless they confirm: ask first.)
3. Add the `ApiKey` secret on the External Credential principal in Setup (value = the API's `AGENT_API_KEY`; on Render it is generated in the dashboard; update the Salesforce side to match).
4. Assign permission set `Restaurant_API_Access` to the user running tests and to the agent user (`mylapore_restaurant_assistant@...ext`).
5. Add the Salesforce client ID/secret as env vars on the Render API service if outbox sync is wanted.
6. Deploy the CSP trusted site for dish images (placeholder, currently not deployed). Re-test Live Test; cards should render.

## 4. Rules and preferences
- Keep the backend/API/DB intact when only UI changes. Never invent menu data, prices or order numbers. Actions need customer confirmation before create/cancel; cancellation reported only if the backend says `cancelled=true`; prices are never sent to the backend.
- Do not print or commit secrets. The GitHub repo is public. Local `backend/.env` holds real secrets: never overwrite it; never push it as is.
- Windows 11, PowerShell/Bash. Use the Write tool for files (heredoc quoting breaks). Stop the API before `prisma generate` (EPERM). Org alias is `YatraBus`. Deploy with `--test-level RunSpecifiedTests --tests RestaurantApiServiceTest --tests RestaurantActionsTest --tests RestaurantControllersTest`.
- Write replies in plain language, state what was verified and what was not.

## 5. Update 2026-11-13: live agent test results (done by Claude in Chrome, Builder Live Test, agent version 1 Active)
- The API is now reachable from Salesforce (earlier UNREACHABLE is resolved). The agent works end to end on real data and passed tests 1, 2, 4, 5, 7, 8, 9, 14 (menu with 8 categories and rupee prices, dosa search, delivery check for 517501, takeaway order read-back then confirmed order, non-veg refusal, wrong-phone lookup gives no hint, cancel checks status first then cancels, Telugu reply). Tests 12 and 13 passed earlier. Not run: 3, 6, 10, 11 (they create payment links/reservations or need the kitchen board).
- The test order VR261113-9EE16E (2 masala dosas, Rs 180) was created and then cancelled in the real database.
- Open item A (cards): Builder preview still shows plain text and `__supports_result_display__: false` even though action data is correct. The preview does not draw custom Lightning Type cards; they appear only in an Enhanced Chat v2 (Messaging for In-App and Web) channel connected to the agent. Mylapore has no such channel yet: that is the next step (create the channel, connect the agent, test cards there). Do not keep changing the Lightning Types for this.
- Open item B (missing total): after placing an order the reply omits the total. Fix: new agent version, in the PlaceOrder subagent instructions add "Always state the total amount from the response, in rupees."
