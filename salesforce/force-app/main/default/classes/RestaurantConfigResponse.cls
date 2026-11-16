/**
 * Charges and options exactly as the backend applies them.
 * Apex-defined type: structured input/output for Agentforce actions and Lightning Web Components.
 */
@JsonAccess(serializable='always' deserializable='always')
public with sharing class RestaurantConfigResponse {
    @AuraEnabled @InvocableVariable(label='Success' description='True when the restaurant API call succeeded')
    public Boolean success;

    @AuraEnabled @InvocableVariable(label='Error Code' description='Machine-readable error code when success is false')
    public String errorCode;

    @AuraEnabled @InvocableVariable(label='Message' description='Human-readable error or info message')
    public String message;

    @AuraEnabled @InvocableVariable(label='Currency Code' description='Currency code')
    public String currencyCode;

    @AuraEnabled @InvocableVariable(label='Tax Percent' description='Tax percentage applied to the subtotal')
    public Decimal taxPercent;

    @AuraEnabled @InvocableVariable(label='Delivery Fee' description='Delivery fee in rupees')
    public Decimal deliveryFee;

    @AuraEnabled @InvocableVariable(label='Service Pincodes' description='Pincodes served for delivery')
    public List<String> servicePincodes = new List<String>();

    @AuraEnabled @InvocableVariable(label='Fulfilment Options' description='Supported order types')
    public List<String> fulfilmentOptions = new List<String>();

    @AuraEnabled @InvocableVariable(label='Payment Methods' description='Supported payment methods')
    public List<String> paymentMethods = new List<String>();

    @AuraEnabled @InvocableVariable(label='Cancellation Policy' description='Cancellation policy text')
    public String cancellationPolicy;
}
