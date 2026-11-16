/** Agentforce action: getMenuItemDetails. Full details of one dish. */
public with sharing class RestaurantItemDetailsAction {
    @JsonAccess(serializable='always' deserializable='always')
    public class Request {
        @InvocableVariable(required=true label='Item Reference' description='The dish id (preferred) or slug returned by the menu actions, for example masala-dosa.')
        public String itemReference;
    }

    @JsonAccess(serializable='always' deserializable='always')
    public class Response {
        @InvocableVariable(label='Item Details' description='The dish with price, availability, dietary info, ingredients and allergens when supplied. Check success before using it.')
        public RestaurantItemDetails details;
    }

    @InvocableMethod(
        label='Get Menu Item Details'
        description='Retrieves one dish with its real price, availability, dietary labels, ingredients and allergens (only when the restaurant supplied them). Use it before recommending a dish or answering questions about ingredients or allergies.'
        category='Restaurant'
    )
    public static List<Response> getMenuItemDetails(List<Request> requests) {
        List<Response> out = new List<Response>();
        for (Request r : requests) {
            Response resp = new Response();
            try {
                resp.details = RestaurantApiService.getItemDetails(r.itemReference);
            } catch (RestaurantApiException e) {
                resp.details = RestaurantErrors.itemDetails(e);
            }
            out.add(resp);
        }
        return out;
    }
}
