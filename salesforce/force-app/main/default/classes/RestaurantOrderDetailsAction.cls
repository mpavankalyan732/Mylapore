/** Agentforce action: getOrderDetails. Full details of an order, after an ownership check on the phone number. */
public with sharing class RestaurantOrderDetailsAction {
    @JsonAccess(serializable='always' deserializable='always')
    public class Request {
        @InvocableVariable(required=true label='Order Number' description='The order number the customer was given, for example VR261111-AB12CD.')
        public String orderNumber;
        @InvocableVariable(required=true label='Customer Phone' description='The mobile number the order was placed with. It proves the order belongs to the customer.')
        public String customerPhone;
    }

    @JsonAccess(serializable='always' deserializable='always')
    public class Response {
        @InvocableVariable(label='Order Details' description='Items, quantities, totals, status, dates and whether the order can still be cancelled. Check success before using it.')
        public RestaurantOrderDetails details;
    }

    @InvocableMethod(
        label='Get Order Details'
        description='Retrieves the items, quantities, total, status and date of an existing order. Requires the order number and the phone number used for the order. Never guess an order number.'
        category='Restaurant'
    )
    public static List<Response> getOrderDetails(List<Request> requests) {
        List<Response> out = new List<Response>();
        for (Request r : requests) {
            Response resp = new Response();
            try {
                resp.details = RestaurantApiService.getOrderDetails(r.orderNumber, r.customerPhone);
            } catch (RestaurantApiException e) {
                resp.details = RestaurantErrors.orderDetails(e);
            }
            out.add(resp);
        }
        return out;
    }
}
