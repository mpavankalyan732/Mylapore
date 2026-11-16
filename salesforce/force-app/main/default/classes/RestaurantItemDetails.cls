/**
 * Full details of one dish.
 * Apex-defined type: structured input/output for Agentforce actions and Lightning Web Components.
 */
@JsonAccess(serializable='always' deserializable='always')
public with sharing class RestaurantItemDetails {
    @AuraEnabled @InvocableVariable(label='Success' description='True when the restaurant API call succeeded')
    public Boolean success;

    @AuraEnabled @InvocableVariable(label='Error Code' description='Machine-readable error code when success is false')
    public String errorCode;

    @AuraEnabled @InvocableVariable(label='Message' description='Human-readable error or info message')
    public String message;

    @AuraEnabled @InvocableVariable(label='Item' description='The dish')
    public RestaurantMenuItem item;

    @AuraEnabled @InvocableVariable(label='Nutrition Available' description='True if nutrition values exist')
    public Boolean nutritionAvailable;

    @AuraEnabled @InvocableVariable(label='Nutrition Summary' description='Nutrition values as text, if any')
    public String nutritionSummary;

    @AuraEnabled @InvocableVariable(label='Notice' description='Safety notice about allergens')
    public String notice;
}
