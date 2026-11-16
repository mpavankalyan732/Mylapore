# API integration inventory

Base URL: `https://<your-public-host>/api/v1`   (Named Credential `Restaurant_API`)
Auth for Salesforce: header `x-api-key: <AGENT_API_KEY>` (added by the External Credential, never in code).
All money values are returned in rupees (`price`, `total`) **and** paise (`pricePaise`, `totalPaise`). Currency is `INR`.

## A. Endpoints Salesforce uses (`/agent/*`, built for this integration)

| Method and path | Purpose | Apex service method | Agentforce action | LWC controller |
|---|---|---|---|---|
| `GET /agent/config` | Tax %, delivery fee, delivery pincodes, order types, payment methods, cancellation policy | `getConfig` | `getRestaurantCharges` | `RestaurantMenuController.getConfig` |
| `GET /agent/menu?category=&subcategory=&q=&includeUnavailable=` | Categories with their dishes | `getMenu` | `getRestaurantMenu` | `RestaurantMenuController.getMenu` |
| `GET /agent/categories` | Categories (no dishes) | `getCategories` | `getMenuCategories` | - |
| `GET /agent/items?category=&subcategory=&q=&includeUnavailable=` | Flat dish search | `getItems` | `getMenuItems` | - |
| `GET /agent/items/:idOrSlug` | One dish | `getItemDetails` | `getMenuItemDetails` | `RestaurantMenuController.getItemDetails` |
| `POST /agent/orders` (+ `Idempotency-Key` header or `idempotencyKey`) | Place an order | `createOrder` | `createRestaurantOrder` | `RestaurantOrderController.placeOrder` |
| `POST /agent/orders/details` `{orderNumber, customerPhone}` | Order details | `getOrderDetails` | `getOrderDetails` | `getOrderDetails` |
| `POST /agent/orders/status` `{orderNumber, customerPhone}` | Order status | `getOrderStatus` | `getOrderStatus` | `getOrderStatus` |
| `POST /agent/orders/cancel` `{orderNumber, customerPhone, reason?}` | Cancel an order | `cancelOrder` | `cancelRestaurantOrder` | `cancelOrder` |
| `POST /agent/reservations` | Request a table | `createReservation` | `createReservation` | `createReservation` |
| `POST /agent/reservations/details` `{reservationId, customerPhone}` | Reservation details | `getReservation` | `getReservation` | `getReservation` |
| `POST /agent/reservations/cancel` `{reservationId, customerPhone}` | Cancel a reservation | `cancelReservation` | `cancelReservation` | `cancelReservation` |

Notes
- Order and reservation lookups use **phone ownership**: a wrong phone or unknown number returns the same `404` (no enumeration).
- `POST /agent/orders` reuses the website's order logic: server-side pricing, availability check, delivery-area check, idempotency. Client-sent prices are rejected (`400`).
- Cancellation rule (enforced by the backend): allowed while the order is `PENDING_PAYMENT` or `CONFIRMED`. Not allowed once `PREPARING`, `READY`, `OUT_FOR_DELIVERY`, `COMPLETED` or already closed. A paid online order is cancelled and flagged `REFUND_REQUIRED`.
- Subcategories: the menu has none. `subcategory` is accepted, ignored, and a warning is returned. `subcategories` is always `[]` today.
- Customization: no structured options exist. `customizations` is `[]`; each ordered item accepts free-text `notes`.
- Rate limits per IP: 300/min reads, 60/min lookups, 20/min writes.

### Errors
`{"statusCode": 409, "code": "ITEM_UNAVAILABLE", "message": "...", "itemIds": ["..."]}`

| HTTP | `code` | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` (no `code`) | Bad input (`message` may be a list) |
| 401 | - | Missing/wrong API key |
| 404 | - | Unknown item, or order/reservation not found for that phone |
| 409 | `ITEM_UNAVAILABLE`, `PRICE_CHANGED`, `STATUS_CHANGED` | Business conflict |
| 422 | `DELIVERY_OUT_OF_AREA`, `ADDRESS_REQUIRED`, `COD_DISABLED` | Rule not met |
| 429 | - | Rate limited |

### Example: place an order
```http
POST /api/v1/agent/orders
x-api-key: ***
Idempotency-Key: 6f1c1d9e-7d0b-4a52-9b70-2d4a3d6f0a11
Content-Type: application/json

{ "items": [{ "menuItemId": "<id from the menu>", "quantity": 2, "notes": "less spicy" }],
  "customer": { "name": "Asha", "phone": "9876543210" },
  "fulfilment": "TAKEAWAY", "paymentMethod": "COD" }
```
```json
{ "orderNumber": "VR261111-AB12CD", "status": "CONFIRMED", "paymentStatus": "COD_PENDING",
  "items": [{ "menuItemId": "...", "name": "Masala Dosa", "quantity": 2, "notes": "less spicy", "unitPrice": 90, "lineTotal": 180 }],
  "subtotal": 180, "tax": 0, "deliveryFee": 0, "total": 180, "currency": "INR",
  "cancellable": true, "nextAction": "NONE", "checkoutUrl": null,
  "trackingUrl": "https://<site>/order/VR261111-AB12CD?t=...", "confirmation": "Order VR261111-AB12CD is confirmed and sent to the kitchen." }
```
For `paymentMethod: "ONLINE"` the order is `PENDING_PAYMENT`, `nextAction` is `OPEN_CHECKOUT` and `checkoutUrl` is the hosted payment page. The order only reaches the kitchen after the payment provider's **signed webhook** confirms payment.

## B. Existing endpoints (unchanged, used by the website)
`GET /menu`, `GET /menu/config`, `GET /menu/items/:slug`, `POST /orders`, `GET /orders/:orderNumber?token=`, `POST /reservations`, `POST /auth/*`, `GET /me/orders`, `/kitchen/*` (staff), `POST /payments/webhook/:provider`, `GET /health`, plus the older `POST /integrations/agentforce/order-lookup` and `POST /integrations/salesforce/order-status`. The new `/agent/*` API does not change any of them.

## C. Data model
Salesforce stores **no restaurant data** and has **no custom objects**. PostgreSQL remains the only source of truth for menu, prices, orders and reservations. The Apex-defined types below only carry data between the API and the agent/LWC during a call.

| Apex type | Used for |
|---|---|
| `RestaurantMenuResponse` > `RestaurantCategory` > `RestaurantSubcategory`, `RestaurantMenuItem` > `RestaurantCustomization` > `RestaurantCustomizationOption` | Menu, categories, dish search |
| `RestaurantItemDetails` | One dish |
| `RestaurantOrderRequest`, `RestaurantOrderItem` | Placing an order |
| `RestaurantOrderResponse` | Result of placing an order |
| `RestaurantOrderDetails` | Order details |
| `RestaurantOrderStatusResponse` | Order status |
| `RestaurantCancellationRequest`, `RestaurantCancellationResponse` | Cancelling an order |
| `RestaurantReservationRequest`, `RestaurantReservationResponse` | Reservations |
| `RestaurantConfigResponse` | Charges and options |
