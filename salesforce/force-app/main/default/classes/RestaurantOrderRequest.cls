/**
 * Everything needed to place an order. Prices are never sent: the backend calculates them.
 * Apex-defined type: structured input/output for Agentforce actions and Lightning Web Components.
 */
@JsonAccess(serializable='always' deserializable='always')
public with sharing class RestaurantOrderRequest {
    @AuraEnabled @InvocableVariable(label='Customer Name' description='Customer name')
    public String customerName;

    @AuraEnabled @InvocableVariable(label='Customer Phone' description='Customer Indian mobile number')
    public String customerPhone;

    @AuraEnabled @InvocableVariable(label='Customer Email' description='Customer email (optional)')
    public String customerEmail;

    @AuraEnabled @InvocableVariable(label='Fulfilment' description='TAKEAWAY, DELIVERY or DINE_IN')
    public String fulfilment;

    @AuraEnabled @InvocableVariable(label='Payment Method' description='ONLINE or COD (pay at counter / on delivery)')
    public String paymentMethod;

    @AuraEnabled @InvocableVariable(label='Delivery Address Line' description='Delivery address (required for DELIVERY)')
    public String deliveryAddressLine;

    @AuraEnabled @InvocableVariable(label='Delivery Pincode' description='6-digit delivery pincode (required for DELIVERY)')
    public String deliveryPincode;

    @AuraEnabled @InvocableVariable(label='Delivery Landmark' description='Delivery landmark (optional)')
    public String deliveryLandmark;

    @AuraEnabled @InvocableVariable(label='Notes' description='Order-level instructions')
    public String notes;

    @AuraEnabled @InvocableVariable(label='Idempotency Key' description='Optional unique key to prevent duplicate orders')
    public String idempotencyKey;

    @AuraEnabled @InvocableVariable(label='Items' description='Ordered dishes')
    public List<RestaurantOrderItem> items = new List<RestaurantOrderItem>();
}
