/**
 * Result of placing an order. Only trust orderNumber when success is true.
 * Apex-defined type: structured input/output for Agentforce actions and Lightning Web Components.
 */
@JsonAccess(serializable='always' deserializable='always')
public with sharing class RestaurantOrderResponse {
    @AuraEnabled @InvocableVariable(label='Success' description='True only when the backend created the order')
    public Boolean success;

    @AuraEnabled @InvocableVariable(label='Error Code' description='Machine-readable error code when success is false')
    public String errorCode;

    @AuraEnabled @InvocableVariable(label='Message' description='Human-readable error or info message')
    public String message;

    @AuraEnabled @InvocableVariable(label='Order Number' description='Order number issued by the backend')
    public String orderNumber;

    @AuraEnabled @InvocableVariable(label='Status' description='Order status')
    public String status;

    @AuraEnabled @InvocableVariable(label='Status Message' description='Plain-language status')
    public String statusMessage;

    @AuraEnabled @InvocableVariable(label='Payment Status' description='Payment status')
    public String paymentStatus;

    @AuraEnabled @InvocableVariable(label='Payment Method' description='ONLINE or COD')
    public String paymentMethod;

    @AuraEnabled @InvocableVariable(label='Fulfilment' description='TAKEAWAY, DELIVERY or DINE_IN')
    public String fulfilment;

    @AuraEnabled @InvocableVariable(label='Currency Code' description='Currency code')
    public String currencyCode;

    @AuraEnabled @InvocableVariable(label='Subtotal' description='Subtotal in rupees')
    public Decimal subtotal;

    @AuraEnabled @InvocableVariable(label='Tax' description='Tax in rupees')
    public Decimal tax;

    @AuraEnabled @InvocableVariable(label='Delivery Fee' description='Delivery fee in rupees')
    public Decimal deliveryFee;

    @AuraEnabled @InvocableVariable(label='Total' description='Final total in rupees calculated by the backend')
    public Decimal total;

    @AuraEnabled @InvocableVariable(label='Items' description='Ordered dishes with backend prices')
    public List<RestaurantOrderItem> items = new List<RestaurantOrderItem>();

    @AuraEnabled @InvocableVariable(label='Checkout Url' description='Hosted payment page URL for online orders')
    public String checkoutUrl;

    @AuraEnabled @InvocableVariable(label='Tracking Url' description='Website link to track the order')
    public String trackingUrl;

    @AuraEnabled @InvocableVariable(label='Next Action' description='OPEN_CHECKOUT when the customer must pay online, else NONE')
    public String nextAction;

    @AuraEnabled @InvocableVariable(label='Confirmation' description='Confirmation text from the backend')
    public String confirmation;

    @AuraEnabled @InvocableVariable(label='Replay' description='True if this is a previously created order returned again')
    public Boolean replay;

    @AuraEnabled @InvocableVariable(label='Unavailable Item Ids' description='Identifiers of dishes that are no longer available')
    public List<String> unavailableItemIds = new List<String>();
}
