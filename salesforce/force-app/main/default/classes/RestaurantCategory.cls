/**
 * A menu category with its subcategories and (for menu responses) its dishes.
 * Apex-defined type: structured input/output for Agentforce actions and Lightning Web Components.
 */
@JsonAccess(serializable='always' deserializable='always')
public with sharing class RestaurantCategory {
    @AuraEnabled @InvocableVariable(label='Id' description='Category identifier')
    public String id;

    @AuraEnabled @InvocableVariable(label='Slug' description='URL-safe category name')
    public String slug;

    @AuraEnabled @InvocableVariable(label='Name' description='Category name')
    public String name;

    @AuraEnabled @InvocableVariable(label='Description' description='Category description if any')
    public String description;

    @AuraEnabled @InvocableVariable(label='Image Url' description='Representative image URL')
    public String imageUrl;

    @AuraEnabled @InvocableVariable(label='Item Count' description='Number of dishes')
    public Integer itemCount;

    @AuraEnabled @InvocableVariable(label='Available Item Count' description='Number of dishes currently available')
    public Integer availableItemCount;

    @AuraEnabled @InvocableVariable(label='Subcategories' description='Subcategories (empty today)')
    public List<RestaurantSubcategory> subcategories = new List<RestaurantSubcategory>();

    @AuraEnabled @InvocableVariable(label='Items' description='Dishes in this category')
    public List<RestaurantMenuItem> items = new List<RestaurantMenuItem>();
}
