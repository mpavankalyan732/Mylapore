/** Payment state of an order: PENDING_PAYMENT, PAID, FAILED or EXPIRED. PAID is only ever set by the backend after a verified webhook. */
@JsonAccess(serializable='always' deserializable='always')
public with sharing class RestaurantPaymentStatus {
    @AuraEnabled public Boolean success;
    @AuraEnabled public String errorCode;
    @AuraEnabled public String message;
    @AuraEnabled public String orderNumber;
    @AuraEnabled public String status;
    @AuraEnabled public String orderStatus;
    @AuraEnabled public Decimal amount;
    @AuraEnabled public String currencyCode;
    @AuraEnabled public String paidAt;
    @AuraEnabled public String expiresAt;
}
