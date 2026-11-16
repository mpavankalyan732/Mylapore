/** Agentforce action: getMenuCategories. Lists every menu category (and its subcategories, if any) without the dishes. */
public with sharing class RestaurantCategoryAction {
    @JsonAccess(serializable='always' deserializable='always')
    public class Request {
        @InvocableVariable(label='Reserved' description='No input is needed. Leave empty.')
        public String reserved;
    }

    @JsonAccess(serializable='always' deserializable='always')
    public class Response {
        @InvocableVariable(label='Categories' description='All menu categories with ids, names, images and item counts. Check success before using it.')
        public RestaurantMenuResponse menu;
    }

    @InvocableMethod(
        label='Get Menu Categories'
        description='Lists every menu category with its id, name and number of dishes (and subcategories if the menu defines any). Use it when the customer asks what kinds of food are available.'
        category='Restaurant'
    )
    public static List<Response> getMenuCategories(List<Request> requests) {
        List<Response> out = new List<Response>();
        for (Request r : requests) {
            Response resp = new Response();
            try {
                resp.menu = RestaurantApiService.getCategories();
            } catch (RestaurantApiException e) {
                resp.menu = RestaurantErrors.menu(e);
            }
            out.add(resp);
        }
        return out;
    }
}
