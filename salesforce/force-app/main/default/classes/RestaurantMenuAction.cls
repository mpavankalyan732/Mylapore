/**
 * Agentforce action: getRestaurantMenu
 * Returns the complete live menu (categories with their dishes) from the restaurant API.
 * Callouts: one per request. Agentforce invokes this with a single request at a time (limit: 100 callouts per transaction).
 */
public with sharing class RestaurantMenuAction {
    @JsonAccess(serializable='always' deserializable='always')
    public class Request {
        @InvocableVariable(label='Category' description='Optional. Category id, slug or name to filter by, for example idli-dosa or Idli & Dosa. Leave empty for the full menu.')
        public String category;
        @InvocableVariable(label='Subcategory' description='Optional. The menu currently has no subcategories; if set it is ignored and a warning is returned.')
        public String subcategory;
        @InvocableVariable(label='Search Text' description='Optional. Words to look for in dish names, descriptions and tags, for example dosa or paneer.')
        public String searchText;
        @InvocableVariable(label='Include Unavailable' description='Set to true only if the customer asks about dishes that are currently unavailable.')
        public Boolean includeUnavailable;
    }

    @JsonAccess(serializable='always' deserializable='always')
    public class Response {
        @InvocableVariable(label='Menu' description='The restaurant menu: categories with dishes, real prices and availability. Check success before using it.')
        public RestaurantMenuResponse menu;
    }

    @InvocableMethod(
        label='Get Restaurant Menu'
        description='Retrieves the live restaurant menu (categories, dishes, real prices, availability, dietary info). Use it whenever the customer asks what is on the menu or asks about a category or dish. Never invent menu data.'
        category='Restaurant'
    )
    public static List<Response> getRestaurantMenu(List<Request> requests) {
        List<Response> out = new List<Response>();
        for (Request r : requests) {
            Response resp = new Response();
            try {
                resp.menu = RestaurantApiService.getMenu(r.category, r.subcategory, r.searchText, r.includeUnavailable);
            } catch (RestaurantApiException e) {
                resp.menu = RestaurantErrors.menu(e);
            }
            out.add(resp);
        }
        return out;
    }
}
