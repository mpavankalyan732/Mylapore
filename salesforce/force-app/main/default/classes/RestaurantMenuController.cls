/**
 * Apex controller for the restaurantOrdering Lightning Web Component: menu, item details and charges.
 * Not cacheable on purpose: availability and prices change, so the menu is always read live.
 */
public with sharing class RestaurantMenuController {
    @AuraEnabled
    public static RestaurantMenuResponse getMenu(String category, String subcategory, String searchText, Boolean includeUnavailable) {
        try {
            return RestaurantApiService.getMenu(category, subcategory, searchText, includeUnavailable);
        } catch (RestaurantApiException e) {
            throw RestaurantAuraSupport.toAura(e);
        }
    }

    @AuraEnabled
    public static RestaurantItemDetails getItemDetails(String itemReference) {
        try {
            return RestaurantApiService.getItemDetails(itemReference);
        } catch (RestaurantApiException e) {
            throw RestaurantAuraSupport.toAura(e);
        }
    }

    /** Tax percentage, delivery fee, service pincodes and supported order types/payment methods, as the backend applies them. */
    @AuraEnabled
    public static RestaurantConfigResponse getConfig() {
        try {
            return RestaurantApiService.getConfig();
        } catch (RestaurantApiException e) {
            throw RestaurantAuraSupport.toAura(e);
        }
    }
}
