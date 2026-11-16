/**
 * One selectable option of a customization (none exist in the backend today).
 * Apex-defined type: structured input/output for Agentforce actions and Lightning Web Components.
 */
@JsonAccess(serializable='always' deserializable='always')
public with sharing class RestaurantCustomizationOption {
    @AuraEnabled @InvocableVariable(label='Id' description='Option identifier')
    public String id;

    @AuraEnabled @InvocableVariable(label='Name' description='Option name')
    public String name;

    @AuraEnabled @InvocableVariable(label='Price Delta' description='Extra price in rupees for this option')
    public Decimal priceDelta;
}
