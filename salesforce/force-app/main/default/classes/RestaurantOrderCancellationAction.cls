/**
 * Agentforce action: cancelRestaurantOrder
 * The backend enforces the cancellation rules (allowed until the kitchen starts preparing).
 * This action refuses to call the backend unless the customer explicitly confirmed.
 */
public with sharing class RestaurantOrderCancellationAction {
    @JsonAccess(serializable='always' deserializable='always')
    public class Request {
        @InvocableVariable(required=true label='Cancellation Request' description='Order number, the phone number used for the order, an optional reason, and confirmed=true only after the customer explicitly agreed to cancel.')
        public RestaurantCancellationRequest cancellation;
    }

    @JsonAccess(serializable='always' deserializable='always')
    public class Response {
        @InvocableVariable(label='Cancellation Result' description='The order is cancelled only when cancelled is true. Otherwise explain the message (for example the kitchen has already started).')
        public RestaurantCancellationResponse result;
    }

    @InvocableMethod(
        label='Cancel Restaurant Order'
        description='Cancels an order when the restaurant rules allow it. First check the order status, tell the customer what will happen, and get an explicit yes. Never say an order is cancelled unless cancelled is true.'
        category='Restaurant'
    )
    public static List<Response> cancelRestaurantOrder(List<Request> requests) {
        List<Response> out = new List<Response>();
        for (Request r : requests) {
            Response resp = new Response();
            RestaurantCancellationRequest c = r.cancellation;
            if (c == null || c.confirmed != true) {
                resp.result = new RestaurantCancellationResponse();
                resp.result.success = false;
                resp.result.cancelled = false;
                resp.result.code = 'CONFIRMATION_REQUIRED';
                resp.result.message = 'The order was not cancelled because the customer has not explicitly confirmed. Ask for a clear yes first.';
                if (c != null) {
                    resp.result.orderNumber = c.orderNumber;
                }
            } else {
                try {
                    resp.result = RestaurantApiService.cancelOrder(c.orderNumber, c.customerPhone, c.reason);
                } catch (RestaurantApiException e) {
                    resp.result = RestaurantErrors.cancellation(e);
                }
            }
            out.add(resp);
        }
        return out;
    }
}
