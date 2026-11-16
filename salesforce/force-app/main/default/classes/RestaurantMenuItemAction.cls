/** Agentforce action: getMenuItems. Searches and filters dishes and returns a flat list with real prices and availability. */
public with sharing class RestaurantMenuItemAction {
    @JsonAccess(serializable='always' deserializable='always')
    public class Request {
        @InvocableVariable(label='Category' description='Optional. Category id, slug or name to filter by.')
        public String category;
        @InvocableVariable(label='Subcategory' description='Optional. The menu currently has no subcategories; if set it is ignored and a warning is returned.')
        public String subcategory;
        @InvocableVariable(label='Search Text' description='Optional. Words to look for in dish names, descriptions and tags, for example dosa varieties or paneer.')
        public String searchText;
        @InvocableVariable(label='Include Unavailable' description='Set to true only if the customer asks about unavailable dishes.')
        public Boolean includeUnavailable;
    }

    @JsonAccess(serializable='always' deserializable='always')
    public class Response {
        @InvocableVariable(label='Menu Items' description='Matching dishes with ids, real prices and availability. Check success before using it. An empty list means nothing matched.')
        public RestaurantMenuResponse menu;
    }

    @InvocableMethod(
        label='Get Menu Items'
        description='Finds dishes by category and/or search text and returns their ids, real prices and availability. Use it to answer questions such as "show dosa varieties" or "anything with paneer". Never invent dishes or prices.'
        category='Restaurant'
    )
    public static List<Response> getMenuItems(List<Request> requests) {
        List<Response> out = new List<Response>();
        for (Request r : requests) {
            Response resp = new Response();
            try {
                resp.menu = RestaurantApiService.getItems(r.category, r.subcategory, r.searchText, r.includeUnavailable);
            } catch (RestaurantApiException e) {
                resp.menu = RestaurantErrors.menu(e);
            }
            out.add(resp);
        }
        return out;
    }
}
