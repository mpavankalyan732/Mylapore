/**
 * Turns a RestaurantApiException into the typed "failure" response for each action.
 * Actions return success=false (instead of throwing) so the agent can explain the problem accurately
 * and can never mistake a failure for a confirmation.
 */
public with sharing class RestaurantErrors {
    public static RestaurantMenuResponse menu(RestaurantApiException e) {
        RestaurantMenuResponse r = new RestaurantMenuResponse();
        r.success = false;
        r.errorCode = e.errorCode;
        r.message = e.getMessage();
        return r;
    }

    public static RestaurantItemDetails itemDetails(RestaurantApiException e) {
        RestaurantItemDetails r = new RestaurantItemDetails();
        r.success = false;
        r.errorCode = e.errorCode;
        r.message = e.getMessage();
        return r;
    }

    public static RestaurantOrderResponse order(RestaurantApiException e) {
        RestaurantOrderResponse r = new RestaurantOrderResponse();
        r.success = false;
        r.errorCode = e.errorCode;
        r.message = e.getMessage();
        r.unavailableItemIds = RestaurantApiMapper.strings(e.details, 'itemIds');
        return r;
    }

    public static RestaurantOrderDetails orderDetails(RestaurantApiException e) {
        RestaurantOrderDetails r = new RestaurantOrderDetails();
        r.success = false;
        r.errorCode = e.errorCode;
        r.message = e.errorCode == 'NOT_FOUND' ? 'No order was found for that order number and phone number.' : e.getMessage();
        return r;
    }

    public static RestaurantOrderStatusResponse orderStatus(RestaurantApiException e) {
        RestaurantOrderStatusResponse r = new RestaurantOrderStatusResponse();
        r.success = false;
        r.errorCode = e.errorCode;
        r.message = e.errorCode == 'NOT_FOUND' ? 'No order was found for that order number and phone number.' : e.getMessage();
        return r;
    }

    public static RestaurantCancellationResponse cancellation(RestaurantApiException e) {
        RestaurantCancellationResponse r = new RestaurantCancellationResponse();
        r.success = false;
        r.cancelled = false; // never claim a cancellation the backend did not confirm
        r.errorCode = e.errorCode;
        r.message = e.errorCode == 'NOT_FOUND' ? 'No order was found for that order number and phone number.' : e.getMessage();
        return r;
    }

    public static RestaurantReservationResponse reservation(RestaurantApiException e) {
        RestaurantReservationResponse r = new RestaurantReservationResponse();
        r.success = false;
        r.errorCode = e.errorCode;
        r.message = e.errorCode == 'NOT_FOUND' ? 'No reservation was found for that reservation id and phone number.' : e.getMessage();
        return r;
    }

    public static RestaurantConfigResponse config(RestaurantApiException e) {
        RestaurantConfigResponse r = new RestaurantConfigResponse();
        r.success = false;
        r.errorCode = e.errorCode;
        r.message = e.getMessage();
        return r;
    }
}
