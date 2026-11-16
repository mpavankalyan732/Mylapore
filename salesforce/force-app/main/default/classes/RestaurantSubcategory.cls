/**
 * A subcategory of a menu category (the restaurant menu has none today; kept for forward compatibility).
 * Apex-defined type: structured input/output for Agentforce actions and Lightning Web Components.
 */
@JsonAccess(serializable='always' deserializable='always')
public with sharing class RestaurantSubcategory {
    @AuraEnabled @InvocableVariable(label='Id' description='Subcategory identifier')
    public String id;

    @AuraEnabled @InvocableVariable(label='Slug' description='URL-safe name')
    public String slug;

    @AuraEnabled @InvocableVariable(label='Name' description='Subcategory name')
    public String name;

    @AuraEnabled @InvocableVariable(label='Description' description='Subcategory description')
    public String description;
}
