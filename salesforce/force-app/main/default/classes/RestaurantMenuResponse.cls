/**
 * Result of a menu, category or item search call.
 * Apex-defined type: structured input/output for Agentforce actions and Lightning Web Components.
 */
@JsonAccess(serializable='always' deserializable='always')
public with sharing class RestaurantMenuResponse {
    @AuraEnabled @InvocableVariable(label='Success' description='True when the restaurant API call succeeded')
    public Boolean success;

    @AuraEnabled @InvocableVariable(label='Error Code' description='Machine-readable error code when success is false')
    public String errorCode;

    @AuraEnabled @InvocableVariable(label='Message' description='Human-readable error or info message')
    public String message;

    @AuraEnabled @InvocableVariable(label='Currency Code' description='Currency code')
    public String currencyCode;

    @AuraEnabled @InvocableVariable(label='Total Items' description='Total number of dishes returned')
    public Integer totalItems;

    @AuraEnabled @InvocableVariable(label='Categories' description='Categories (with their dishes for menu calls)')
    public List<RestaurantCategory> categories = new List<RestaurantCategory>();

    @AuraEnabled @InvocableVariable(label='Items' description='Flat list of dishes for item searches')
    public List<RestaurantMenuItem> items = new List<RestaurantMenuItem>();

    @AuraEnabled @InvocableVariable(label='Warnings' description='Notes about ignored filters or empty results')
    public List<String> warnings = new List<String>();
}
