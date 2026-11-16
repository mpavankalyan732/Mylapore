/**
 * Result of a cancellation. Say the order is cancelled only when cancelled is true.
 * Apex-defined type: structured input/output for Agentforce actions and Lightning Web Components.
 */
@JsonAccess(serializable='always' deserializable='always')
public with sharing class RestaurantCancellationResponse {
    @AuraEnabled @InvocableVariable(label='Success' description='True when the restaurant API call succeeded')
    public Boolean success;

    @AuraEnabled @InvocableVariable(label='Cancelled' description='True only when the backend confirmed the cancellation')
    public Boolean cancelled;

    @AuraEnabled @InvocableVariable(label='Code' description='CANCELLED, KITCHEN_STARTED, ALREADY_CANCELLED, READY_OR_DISPATCHED, COMPLETED, CLOSED or CONFIRMATION_REQUIRED')
    public String code;

    @AuraEnabled @InvocableVariable(label='Error Code' description='Machine-readable error code when success is false')
    public String errorCode;

    @AuraEnabled @InvocableVariable(label='Message' description='Human-readable result')
    public String message;

    @AuraEnabled @InvocableVariable(label='Refund Required' description='True if a paid online order needs a refund by the restaurant')
    public Boolean refundRequired;

    @AuraEnabled @InvocableVariable(label='Order Number' description='Order number')
    public String orderNumber;

    @AuraEnabled @InvocableVariable(label='Status' description='Order status after the attempt')
    public String status;

    @AuraEnabled @InvocableVariable(label='Status Message' description='Plain-language status')
    public String statusMessage;

    @AuraEnabled @InvocableVariable(label='Payment Status' description='Payment status after the attempt')
    public String paymentStatus;
}
