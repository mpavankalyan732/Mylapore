# Mylapore Restaurant: Salesforce (Agentforce + Apex + LWC)

Salesforce DX project (API 68.0) that lets an **Agentforce agent** and a **Lightning Web Component** use the existing restaurant backend (NestJS + PostgreSQL, in `../backend`).

- PostgreSQL stays the only source of truth. **No custom Salesforce objects** are created and no menu or order data is copied into Salesforce.
- Salesforce talks to the backend through a **Named Credential + External Credential** and **Apex**. All pricing, availability and cancellation rules stay in the backend.
- **Deployed to the `YatraBus` Developer Edition org on 2026-11-11** (Apex, LWCs, Lightning Types, Named/External Credential, permission set): 65/65 components, 36 Apex tests passing. Still to do there: set the public URL, add the API key secret, assign the permission set (see docs/SETUP.md).

```
Customer -> Agentforce agent -> Apex invocable actions -> RestaurantApiService -> Named Credential -> NestJS /api/v1/agent/* -> PostgreSQL
Staff/guest -> restaurantOrdering LWC -> Apex controllers -> RestaurantApiService -> (same)
```

## Start here
| I want to... | Open |
|---|---|
| Connect Salesforce to the API and deploy | [docs/SETUP.md](docs/SETUP.md) |
| Create the agent and its topics with Claude in Chrome | [docs/AGENTFORCE_BUILDER_PROMPT.md](docs/AGENTFORCE_BUILDER_PROMPT.md) |
| See every endpoint and how it maps to Apex | [docs/API_CONTRACT.md](docs/API_CONTRACT.md) |
| Understand Apex types vs Lightning Types vs LWC | [docs/LIGHTNING_TYPES.md](docs/LIGHTNING_TYPES.md) |

## What is in `force-app/main/default`
| Folder | Contents |
|---|---|
| `classes/` | `RestaurantApiService` (the only callout class), `RestaurantApiMapper`, `RestaurantApiException`, `RestaurantErrors`, `RestaurantAuraSupport`; **12 Agentforce action classes**; 2 LWC controllers; **17 Apex-defined types**; 3 test classes + `RestaurantApiMock` |
| `lwc/restaurantOrdering` (+ `restaurantItemCard`, `restaurantItemModal`, `restaurantCart`, `restaurantCheckout`, `restaurantOrderLookup`) | The ordering experience: live categories, subcategories (when the backend has them), search, lazy loading, item details, cart, checkout, order tracking and cancellation |
| `lwc/restaurant*View`, `restaurantOrderResult` | 7 Agentforce output renderers |
| `lwc/restaurantUtils`, `restaurantStyles` | Shared helpers and a shared CSS library |
| `lightningTypes/` | 7 Apex-based custom Lightning Types (schema + renderer for Lightning Experience and Enhanced Chat) |
| `namedCredentials/`, `externalCredentials/` | `Restaurant_API` (URL placeholder; the API key secret is added in Setup) |
| `permissionsets/` | `Restaurant_API_Access` (Apex classes + credential principal) |
| `cspTrustedSites/` | Image host for dish photos (placeholder until configured) |

## Agentforce actions
`getRestaurantMenu`, `getMenuCategories`, `getMenuItems`, `getMenuItemDetails`, `getRestaurantCharges`, `createRestaurantOrder`, `getOrderDetails`, `getOrderStatus`, `cancelRestaurantOrder`, `createReservation`, `getReservation`, `cancelReservation`.

Safety built into the Apex (not just the agent's instructions):
- `createRestaurantOrder`, `cancelRestaurantOrder`, `createReservation` and `cancelReservation` refuse to call the API unless the customer-confirmed flag is `true`.
- Every action returns `success = false` plus a message on failure and never returns invented data. Cancellation reports `cancelled = true` only when the backend confirmed it.
- Order lookups need the order number **and** the phone number used for the order.
- Prices are never sent to the API; the backend calculates them.
- A retry of the same order within five minutes returns the original order instead of a duplicate (deterministic idempotency key).

## Commands
```bash
npm install                      # once
npm run test:unit                # 63 LWC unit tests
npx eslint "force-app/**/lwc/**/*.js"
node scripts/configure-endpoint.mjs https://YOUR-PUBLIC-HOST      # sets Named Credential + CSP site
sf project deploy start --source-dir force-app --target-org <alias> --dry-run --test-level RunSpecifiedTests --tests RestaurantApiServiceTest --tests RestaurantActionsTest --tests RestaurantControllersTest
```

## Status of verification
Checked: the project validates and deploys in a real org with 36 Apex tests passing (0 failures, every class over 75% coverage); 63 LWC tests pass; ESLint clean; the backend API passes 52 end-to-end checks.
**Not yet checked:** a live callout to the API (needs the public URL, API key and permission set assignment), and how the cards render inside Agentforce chat.

## Known limitations
- The backend has no subcategories and no structured customization options. The types and LWC support them and will show them when the backend adds them. Today, customization is free-text notes per item.
- Ingredients/allergens are drafts until the kitchen confirms them.
- Refunds for cancelled paid online orders are flagged for staff (`REFUND_REQUIRED`), not automatic.
- The Named Credential needs a public HTTPS host. `localhost` cannot be used.
