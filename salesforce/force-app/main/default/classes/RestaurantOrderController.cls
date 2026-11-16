/** Apex controller for the restaurantOrdering Lightning Web Component: orders and reservations. */
public with sharing class RestaurantOrderController {
    @AuraEnabled
    public static RestaurantOrderResponse placeOrder(RestaurantOrderRequest orderRequest) {
        try {
            RestaurantOrderResponse res = RestaurantApiService.createOrder(orderRequest);
            RestaurantOrderRecords.save(orderRequest, res);
            return res;
        } catch (RestaurantApiException e) {
            throw RestaurantAuraSupport.toAura(e);
        }
    }

    @AuraEnabled
    public static RestaurantOrderDetails getOrderDetails(String orderNumber, String customerPhone) {
        try {
            return RestaurantApiService.getOrderDetails(orderNumber, customerPhone);
        } catch (RestaurantApiException e) {
            throw RestaurantAuraSupport.toAura(e);
        }
    }

    @AuraEnabled
    public static RestaurantOrderStatusResponse getOrderStatus(String orderNumber, String customerPhone) {
        try {
            RestaurantOrderStatusResponse res = RestaurantApiService.getOrderStatus(orderNumber, customerPhone);
            RestaurantOrderRecords.updateStatus(res);
            return res;
        } catch (RestaurantApiException e) {
            throw RestaurantAuraSupport.toAura(e);
        }
    }

    /** @param confirmed must be true: the component asks the customer in a confirmation dialog first. */
    @AuraEnabled
    public static RestaurantCancellationResponse cancelOrder(String orderNumber, String customerPhone, String reason, Boolean confirmed) {
        if (confirmed != true) {
            throw RestaurantAuraSupport.plain('Please confirm that you want to cancel this order.');
        }
        try {
            RestaurantCancellationResponse res = RestaurantApiService.cancelOrder(orderNumber, customerPhone, reason);
            RestaurantOrderRecords.markCancelled(res);
            return res;
        } catch (RestaurantApiException e) {
            throw RestaurantAuraSupport.toAura(e);
        }
    }

    @AuraEnabled
    public static RestaurantReservationResponse createReservation(RestaurantReservationRequest reservation) {
        try {
            return RestaurantApiService.createReservation(reservation);
        } catch (RestaurantApiException e) {
            throw RestaurantAuraSupport.toAura(e);
        }
    }

    @AuraEnabled
    public static RestaurantReservationResponse getReservation(String reservationId, String customerPhone) {
        try {
            return RestaurantApiService.getReservation(reservationId, customerPhone);
        } catch (RestaurantApiException e) {
            throw RestaurantAuraSupport.toAura(e);
        }
    }

    @AuraEnabled
    public static RestaurantReservationResponse cancelReservation(String reservationId, String customerPhone, Boolean confirmed) {
        if (confirmed != true) {
            throw RestaurantAuraSupport.plain('Please confirm that you want to cancel this reservation.');
        }
        try {
            return RestaurantApiService.cancelReservation(reservationId, customerPhone);
        } catch (RestaurantApiException e) {
            throw RestaurantAuraSupport.toAura(e);
        }
    }
}
