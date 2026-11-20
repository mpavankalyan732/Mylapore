/**
 * Result of starting an online payment: a Razorpay Payment Link (CARD) or a UPI QR image (UPI_QR).
 * Only trust the URL when success is true. Payment is confirmed by the backend's signed webhook, never by this response.
 */
@JsonAccess(serializable='always' deserializable='always')
public with sharing class RestaurantPaymentStart {
    @AuraEnabled public Boolean success;
    @AuraEnabled public String errorCode;
    @AuraEnabled public String message;
    @AuraEnabled public String orderNumber;
    @AuraEnabled public String method;
    @AuraEnabled public String paymentUrl;
    @AuraEnabled public String qrImageUrl;
    @AuraEnabled public String expiresAt;
}
