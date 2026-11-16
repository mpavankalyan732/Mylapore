/**
 * A customization group for a dish, e.g. spice level (none exist in the backend today; free-text notes are supported per item).
 * Apex-defined type: structured input/output for Agentforce actions and Lightning Web Components.
 */
@JsonAccess(serializable='always' deserializable='always')
public with sharing class RestaurantCustomization {
    @AuraEnabled @InvocableVariable(label='Id' description='Customization identifier')
    public String id;

    @AuraEnabled @InvocableVariable(label='Name' description='Customization name')
    public String name;

    @AuraEnabled @InvocableVariable(label='Customization Type' description='Type of selection')
    public String customizationType;

    @AuraEnabled @InvocableVariable(label='Is Required' description='Whether the customer must choose an option')
    public Boolean isRequired;

    @AuraEnabled @InvocableVariable(label='Options' description='Available options')
    public List<RestaurantCustomizationOption> options = new List<RestaurantCustomizationOption>();
}
