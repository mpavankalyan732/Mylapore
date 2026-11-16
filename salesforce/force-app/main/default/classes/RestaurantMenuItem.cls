/**
 * A dish exactly as the restaurant API returns it. Prices are real backend prices.
 * Apex-defined type: structured input/output for Agentforce actions and Lightning Web Components.
 */
@JsonAccess(serializable='always' deserializable='always')
public with sharing class RestaurantMenuItem {
    @AuraEnabled @InvocableVariable(label='Id' description='Menu item identifier. Use this as menuItemId when ordering.')
    public String id;

    @AuraEnabled @InvocableVariable(label='Slug' description='URL-safe item name')
    public String slug;

    @AuraEnabled @InvocableVariable(label='Name' description='Dish name')
    public String name;

    @AuraEnabled @InvocableVariable(label='Description' description='Dish description')
    public String description;

    @AuraEnabled @InvocableVariable(label='Category Id' description='Category identifier')
    public String categoryId;

    @AuraEnabled @InvocableVariable(label='Category Name' description='Category name')
    public String categoryName;

    @AuraEnabled @InvocableVariable(label='Subcategory' description='Subcategory name if any')
    public String subcategory;

    @AuraEnabled @InvocableVariable(label='Price' description='Price in rupees (INR)')
    public Decimal price;

    @AuraEnabled @InvocableVariable(label='Price Paise' description='Price in paise')
    public Integer pricePaise;

    @AuraEnabled @InvocableVariable(label='Currency Code' description='Currency code')
    public String currencyCode;

    @AuraEnabled @InvocableVariable(label='Is Available' description='True if the dish can be ordered right now')
    public Boolean isAvailable;

    @AuraEnabled @InvocableVariable(label='Is Bestseller' description='True if marked a bestseller')
    public Boolean isBestseller;

    @AuraEnabled @InvocableVariable(label='Image Url' description='Absolute image URL')
    public String imageUrl;

    @AuraEnabled @InvocableVariable(label='Is Vegetarian' description='Vegetarian')
    public Boolean isVegetarian;

    @AuraEnabled @InvocableVariable(label='Is Vegan' description='Vegan (draft until the kitchen confirms)')
    public Boolean isVegan;

    @AuraEnabled @InvocableVariable(label='Is Jain' description='Jain-friendly (draft until the kitchen confirms)')
    public Boolean isJain;

    @AuraEnabled @InvocableVariable(label='Spice Level' description='Mild, Medium or Spicy if known')
    public String spiceLevel;

    @AuraEnabled @InvocableVariable(label='Cuisine' description='Cuisine if known')
    public String cuisine;

    @AuraEnabled @InvocableVariable(label='Tags' description='Tags such as goes-with-rice')
    public List<String> tags = new List<String>();

    @AuraEnabled @InvocableVariable(label='Ingredients' description='Ingredients if supplied (draft until confirmed)')
    public String ingredients;

    @AuraEnabled @InvocableVariable(label='Allergens' description='Allergens if supplied (draft until confirmed)')
    public List<String> allergens = new List<String>();

    @AuraEnabled @InvocableVariable(label='Allows Notes' description='True if free-text notes can be added to this item')
    public Boolean allowsNotes;

    @AuraEnabled @InvocableVariable(label='Customizations' description='Structured customization groups (empty today)')
    public List<RestaurantCustomization> customizations = new List<RestaurantCustomization>();
}
