/**
 * Current status of an order.
 * Apex-defined type: structured input/output for Agentforce actions and Lightning Web Components.
 */
@JsonAccess(serializable='always' deserializable='always')
public with sharing class RestaurantOrderStatusResponse {
    @AuraEnabled @InvocableVariable(label='Success' description='True when the restaurant API call succeeded')
    public Boolean success;

    @AuraEnabled @InvocableVariable(label='Error Code' description='Machine-readable error code when success is false')
    public String errorCode;

    @AuraEnabled @InvocableVariable(label='Message' description='Human-readable error or info message')
    public String message;

    @AuraEnabled @InvocableVariable(label='Order Number' description='Order number')
    public String orderNumber;

    @AuraEnabled @InvocableVariable(label='Status' description='Order status')
    public String status;

    @AuraEnabled @InvocableVariable(label='Status Message' description='Plain-language status')
    public String statusMessage;

    @AuraEnabled @InvocableVariable(label='Payment Status' description='Payment status')
    public String paymentStatus;

    @AuraEnabled @InvocableVariable(label='Fulfilment' description='TAKEAWAY, DELIVERY or DINE_IN')
    public String fulfilment;

    @AuraEnabled @InvocableVariable(label='Currency Code' description='Currency code')
    public String currencyCode;

    @AuraEnabled @InvocableVariable(label='Total' description='Total in rupees')
    public Decimal total;

    @AuraEnabled @InvocableVariable(label='Cancellable' description='True if the order can still be cancelled')
    public Boolean cancellable;

    @AuraEnabled @InvocableVariable(label='Cancellable Reason' description='Why the order can or cannot be cancelled')
    public String cancellableReason;

    @AuraEnabled @InvocableVariable(label='Checkout Url' description='Payment link if payment is still pending')
    public String checkoutUrl;
}
