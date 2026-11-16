/**
 * Request to cancel an order. confirmed must be true: ask the customer first.
 * Apex-defined type: structured input/output for Agentforce actions and Lightning Web Components.
 */
@JsonAccess(serializable='always' deserializable='always')
public with sharing class RestaurantCancellationRequest {
    @AuraEnabled @InvocableVariable(label='Order Number' description='Order number to cancel')
    public String orderNumber;

    @AuraEnabled @InvocableVariable(label='Customer Phone' description='Phone number the order was placed with (ownership check)')
    public String customerPhone;

    @AuraEnabled @InvocableVariable(label='Reason' description='Optional reason')
    public String reason;

    @AuraEnabled @InvocableVariable(label='Confirmed' description='Must be true: the customer explicitly confirmed the cancellation')
    public Boolean confirmed;
}
