# Apex-defined types, Lightning Types and the LWC: how they fit

These are different things. Mixing them up causes most Agentforce integration problems.

| Piece | What it is | In this project |
|---|---|---|
| **Apex-defined types** | Plain Apex classes whose public fields are annotated `@InvocableVariable` (for Agentforce/Flow) and `@AuraEnabled` (for LWC), plus `@JsonAccess(serializable='always' deserializable='always')`. They give an action **structured inputs and outputs** instead of a JSON string. | 17 top-level classes: `RestaurantMenuResponse`, `RestaurantCategory`, `RestaurantSubcategory`, `RestaurantMenuItem`, `RestaurantItemDetails`, `RestaurantCustomization`, `RestaurantCustomizationOption`, `RestaurantOrderRequest`, `RestaurantOrderItem`, `RestaurantOrderResponse`, `RestaurantOrderDetails`, `RestaurantCancellationRequest`, `RestaurantCancellationResponse`, `RestaurantOrderStatusResponse`, `RestaurantReservationRequest`, `RestaurantReservationResponse`, `RestaurantConfigResponse`. |
| **Agentforce actions** | `@InvocableMethod` Apex that the agent can call. Their inner `Request`/`Response` classes use the types above. | 12 action classes (see README). |
| **Custom Lightning Types** | A metadata bundle (`lightningTypes/<name>/`) that tells Agentforce how to **show** an action's output (or collect an input). An *Apex-based* type points at an Apex class and a renderer LWC. | 7 types, one per output shown to customers (menu, item, order result, order details, order status, cancellation, reservation). |
| **Renderer LWCs** | Small components with target `lightning__AgentforceOutput` that receive the typed result as `@api value` and draw it. | `restaurantMenuView`, `restaurantItemView`, `restaurantOrderResult`, `restaurantOrderDetailsView`, `restaurantOrderStatusView`, `restaurantCancellationView`, `restaurantReservationView`. |
| **`restaurantOrdering` LWC** | The full ordering app for use in Lightning Experience (menu, cart, checkout, tracking, cancellation). It uses the same Apex types through `@AuraEnabled` controllers, and reuses two renderers. | Separate from Agentforce. |

## What a Lightning Type bundle looks like here
```
lightningTypes/restaurantOrderResult/
  schema.json                              { "title", "description", "lightning:type": "@apexClassType/c__RestaurantOrderResponse" }
  lightningDesktopGenAi/renderer.json      Employee agent in Lightning Experience
  enhancedWebChat/renderer.json            Service agent in Enhanced Chat v2 (customer-facing website chat)
```
`renderer.json`: `{ "renderer": { "componentOverrides": { "$": { "definition": "c/restaurantOrderResult" } } } }`

Rules followed (from Salesforce's own Lightning Type guidance): an Apex-based `schema.json` contains only `title`, an optional `description` and `lightning:type`; no `type`/`properties`/`examples`. The renderer LWC's `js-meta.xml` has target `lightning__AgentforceOutput` and a `<sourceType name="c__<bundle name>"/>`.

**Learned from a real deployment:** the `sourceType` name is the Lightning Type **bundle folder name** (for example `c__restaurantCancellation`), **not** the Apex class name. Using the class name is rejected by the org.

## Mapping in Agentforce Builder
After adding each Apex action, open its **output** and choose the custom Lightning Type:

| Action | Output field | Lightning Type |
|---|---|---|
| Get Restaurant Menu | `menu` | Restaurant Menu |
| Get Menu Categories | `menu` | Restaurant Menu |
| Get Menu Items | `menu` | Restaurant Menu |
| Get Menu Item Details | `details` | Restaurant Item Details |
| Create Restaurant Order | `order` | Restaurant Order Result |
| Get Order Details | `details` | Restaurant Order Details |
| Get Order Status | `status` | Restaurant Order Status |
| Cancel Restaurant Order | `result` | Restaurant Cancellation Result |
| Create / Get / Cancel Reservation | `reservation` | Restaurant Reservation |
| Get Restaurant Charges and Options | `config` | (none: the agent summarises it in words) |

## What is verified and what is not
Verified here:
- All 40 Apex files parse with an independent Apex parser. (It is NOT a compiler: it missed that `currency` is a reserved Apex word, which only the org's check-only deployment caught.)
- The metadata package converts to Metadata API format with Salesforce's own library, so every file is a recognised type.
- 63 LWC unit tests pass and ESLint (Salesforce LWC rules) is clean.
- The API behind it passes 52 end-to-end checks.

**Verified in a real org (Developer Edition `YatraBus`, API 68.0, 2026-11-11): the whole project (Apex, LWCs, Lightning Types, credentials, permission set) **validates and deploys** (65 of 65 components) and **36 Apex tests pass with no class under 75% coverage**. The org accepted both renderer folders (`lightningDesktopGenAi`, `enhancedWebChat`).

**Not** verified yet:
- A live callout to the restaurant API (needs a public HTTPS host, the API key and the permission set assigned).
- How the cards look inside Agentforce chat. Test in Conversation Preview.

Platform limits worth knowing:
- Apex-based Lightning Types only work for actions whose request and response are **Apex classes** (all ours are).
- Apex-based types are not supported in Experience Builder sites.
- Apex classes used as invocable parameters need a visible no-argument constructor (API 66+). Ours use the default one.
- A `List<List<sObject>>` cannot be an `@InvocableVariable`; we use none.
- Keep type, class and LWC names distinct. Renaming or deleting an Apex class referenced by a type breaks it at runtime.
