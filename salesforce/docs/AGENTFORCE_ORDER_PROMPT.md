# Prompt for Claude in Chrome: wire the order flow with Lightning Types

Paste everything below the line into Claude in Chrome, with the Salesforce org (alias YatraBus) open in the browser.

---

You are working in the Salesforce org **YatraBus** (Agentforce Builder) on the agent **Mylapore_Restaurant_Assistant**. All metadata is already deployed from the DX project. Do not create or edit Apex, LWC, Lightning Types or objects. Your job is to connect and publish the agent so that the answers show as cards. Do not change Named Credentials, API keys or permission sets unless I confirm.

## What already exists (deployed)

**Lightning Types and the card that renders them.** The menu card does the whole ordering flow inside the chat.

| Lightning Type (sourceType) | LWC renderer | Used by action output |
|---|---|---|
| `c__restaurantMenu` | `c-restaurant-menu-view` | Get Restaurant Menu, Get Menu Items, Get Menu Categories |
| `c__restaurantItemDetails` | `c-restaurant-item-view` | Get Menu Item Details |
| `c__restaurantOrderResult` | `c-restaurant-order-result` | Create Restaurant Order |
| `c__restaurantOrderStatus` | `c-restaurant-order-status-view` | Get Order Status |
| `c__restaurantOrderDetails` | `c-restaurant-order-details-view` | Get Order Details |
| `c__restaurantCancellation` | `c-restaurant-cancellation-view` | Cancel Restaurant Order |
| `c__restaurantReservation` | `c-restaurant-reservation-view` | Create Reservation, Get Reservation, Cancel Reservation |

**What the menu card does by itself** (no extra agent action needed):
1. Shows each dish with image, price and an **Add** button (then a − qty + control).
2. **View cart** shows the cart. **Cancel** clears it. **Go to checkout** opens the form.
3. Checkout asks for name, mobile, takeaway / dine-in / delivery, and **payment: Razorpay online or pay at counter**.
4. It calls the Apex order controller, which sends the order to the restaurant API. No prices are ever sent.
5. Online payment: shows **Pay now** (Razorpay page), then updates itself to the **success screen** when the backend confirms payment. Counter payment goes straight to success.
6. **Cancel order** on the payment panel cancels through the backend and shows "cancelled" only if the backend says so.

**Salesforce record.** Every order the backend creates is also saved to the custom object **Restaurant Order (`Restaurant_Order__c`)**, matched on the backend's order number so nothing duplicates. Status, payment status and cancellation update the same record. PostgreSQL stays the source of truth.

| Field | API name |
|---|---|
| Record name | Auto-number `RO-{00000}` |
| Order Number (unique, external id) | `Order_Number__c` |
| Customer Name / Phone | `Customer_Name__c`, `Customer_Phone__c` |
| Fulfilment / Payment Method | `Fulfilment__c`, `Payment_Method__c` |
| Status / Payment Status | `Status__c`, `Payment_Status__c` |
| Currency, Subtotal, Tax, Delivery Fee, Total | `Currency_Code__c`, `Subtotal__c`, `Tax__c`, `Delivery_Fee__c`, `Total__c` |
| Items Summary (long text) | `Items_Summary__c` |

Access to the object comes from the permission set **Restaurant_API_Access**.

## Tasks, in order

1. **Permission set.** Setup > Permission Sets > Restaurant API Access > Manage Assignments. Confirm it is assigned to (a) me and (b) the agent user `mylapore_restaurant_assistant@...`. If either is missing, tell me before assigning.
2. **Action output rendering.** Agentforce Assets > Actions. For each action in the table above, open the output field (`menu`, `item`, `order`, `status`, `details`, `cancellation`, `reservation`), set **Output Rendering** to the matching Lightning Type and save.
3. **Agent Script.** In the Get Restaurant Menu action, confirm the output is exactly:
   ```
   is_displayable: True
   filter_from_agent: False
   complex_data_type_name: "c__restaurantMenu"
   ```
   Check the other actions the same way with their own `c__...` name. Also confirm Create Restaurant Order has `is_displayable: True` and `c__restaurantOrderResult`.
4. **Instructions.** Add to the menu subagent: *"When the customer asks for the menu, a category, or a dish such as idly or dosa, call the menu action with the search text and let the card show the results. Do not repeat the dish list as plain text; write one short sentence only. The card has Add, cart, payment and cancel built in, so tell the customer to use the card. Only use Create Restaurant Order when the customer asks you to place an order in words, and only after they confirm the summary. Never invent prices or order numbers."*
5. **Save, then Commit Version, then Activate.** Do this *after* the script save: saving alone does not change the active version. Then start a **new** Live Test session.
6. **Test** in Live Test and report what you see for each:
   - "show me the menu" shows a card with images and Add buttons
   - "show idly" or "show dosa" shows only those dishes
   - Add, View cart, Go to checkout, choose counter payment, Place order shows the success screen and an order number
   - Repeat with Razorpay: Pay now opens the payment page, and the card flips to success after payment
   - Setup > Object Manager > Restaurant Order: a record exists for that order number with the right status
7. **If the menu fails with "unable to reach the restaurant menu system":** this is not a card problem. The Named Credential `Restaurant_API` has no live endpoint or the `ApiKey` secret is missing. Report that and stop. Do not guess a URL.

## Rules
- Do not print or paste secrets (API key, client secret) anywhere.
- Never claim an order was placed or cancelled unless the card or action shows success.
- Report exactly what you saw, with the trace output for any action that does not show `__supports_result_display__`.
