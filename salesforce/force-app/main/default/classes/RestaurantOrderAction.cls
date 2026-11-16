/**
 * Agentforce action: createRestaurantOrder
 * Submits the order to the restaurant API. The backend validates availability, calculates prices and totals,
 * and issues the order number. Prices are never accepted from the conversation.
 */
public with sharing class RestaurantOrderAction {
    @JsonAccess(serializable='always' deserializable='always')
    public class Request {
        @InvocableVariable(required=true label='Order Request' description='Customer details, order type (TAKEAWAY, DELIVERY or DINE_IN), payment method (ONLINE or COD), delivery address and pincode when delivering, and the items. Each item needs the menuItemId from the menu, a quantity and optional notes for customization. Do not include prices.')
        public RestaurantOrderRequest orderRequest;
        @InvocableVariable(required=true label='Customer Confirmed Order' description='Must be true only after you read the order summary back to the customer and they explicitly said yes. If false, the order is NOT placed.')
        public Boolean customerConfirmed;
    }

    @JsonAccess(serializable='always' deserializable='always')
    public class Response {
        @InvocableVariable(label='Order' description='The result. The order exists only when success is true and orderNumber is set. If checkoutUrl is set, the customer must open it to pay online.')
        public RestaurantOrderResponse order;
    }

    @InvocableMethod(
        label='Create Restaurant Order'
        description='Places a restaurant order after the customer confirmed the summary. Returns the real order number, status and backend-calculated total. For online payment it also returns a checkoutUrl the customer must open. Never claim an order was placed unless success is true.'
        category='Restaurant'
    )
    public static List<Response> createRestaurantOrder(List<Request> requests) {
        List<Response> out = new List<Response>();
        for (Request r : requests) {
            Response resp = new Response();
            if (r.customerConfirmed != true) {
                resp.order = new RestaurantOrderResponse();
                resp.order.success = false;
                resp.order.errorCode = 'CONFIRMATION_REQUIRED';
                resp.order.message = 'The order was not placed because the customer has not confirmed it. Read the order summary back and ask for a clear yes.';
            } else {
                try {
                    resp.order = RestaurantApiService.createOrder(r.orderRequest);
                } catch (RestaurantApiException e) {
                    resp.order = RestaurantErrors.order(e);
                }
            }
            out.add(resp);
        }
        // Copy to Salesforce only after every callout: DML before a callout is not allowed in the same transaction.
        for (Integer i = 0; i < requests.size(); i++) {
            RestaurantOrderRecords.save(requests[i].orderRequest, out[i].order);
        }
        return out;
    }
}
