/** Agentforce action: getOrderStatus. The current, accurate status of an order. */
public with sharing class RestaurantOrderStatusAction {
    @JsonAccess(serializable='always' deserializable='always')
    public class Request {
        @InvocableVariable(required=true label='Order Number' description='The order number the customer was given.')
        public String orderNumber;
        @InvocableVariable(required=true label='Customer Phone' description='The mobile number the order was placed with. It proves the order belongs to the customer.')
        public String customerPhone;
    }

    @JsonAccess(serializable='always' deserializable='always')
    public class Response {
        @InvocableVariable(label='Order Status' description='Status, payment status, total and whether the order can still be cancelled. If checkoutUrl is set the payment is still pending. Check success before using it.')
        public RestaurantOrderStatusResponse status;
    }

    @InvocableMethod(
        label='Get Order Status'
        description='Returns the current status of an order (for example confirmed, preparing, ready, out for delivery, completed or cancelled). Use it when the customer asks where their order is.'
        category='Restaurant'
    )
    public static List<Response> getOrderStatus(List<Request> requests) {
        List<Response> out = new List<Response>();
        for (Request r : requests) {
            Response resp = new Response();
            try {
                resp.status = RestaurantApiService.getOrderStatus(r.orderNumber, r.customerPhone);
            } catch (RestaurantApiException e) {
                resp.status = RestaurantErrors.orderStatus(e);
            }
            out.add(resp);
        }
        return out;
    }
}
