/**
 * Agentforce action: getRestaurantCharges
 * Reads the tax percentage, delivery fee, delivery pincodes, order types, payment methods and cancellation
 * policy exactly as the backend applies them, so the agent never guesses them.
 */
public with sharing class RestaurantConfigAction {
    @JsonAccess(serializable='always' deserializable='always')
    public class Request {
        @InvocableVariable(label='Reserved' description='No input is needed. Leave empty.')
        public String reserved;
    }

    @JsonAccess(serializable='always' deserializable='always')
    public class Response {
        @InvocableVariable(label='Restaurant Charges and Options' description='Tax percentage, delivery fee, delivery pincodes, supported order types and payment methods, cancellation policy. Check success before using it.')
        public RestaurantConfigResponse config;
    }

    @InvocableMethod(
        label='Get Restaurant Charges and Options'
        description='Returns the real tax percentage, delivery fee, delivery pincodes, supported order types (takeaway, delivery, dine-in), payment methods and the cancellation policy. Use it when the customer asks about delivery areas, fees, payment options or cancellation rules. Never guess these.'
        category='Restaurant'
    )
    public static List<Response> getRestaurantCharges(List<Request> requests) {
        List<Response> out = new List<Response>();
        for (Request r : requests) {
            Response resp = new Response();
            try {
                resp.config = RestaurantApiService.getConfig();
            } catch (RestaurantApiException e) {
                resp.config = RestaurantErrors.config(e);
            }
            out.add(resp);
        }
        return out;
    }
}
