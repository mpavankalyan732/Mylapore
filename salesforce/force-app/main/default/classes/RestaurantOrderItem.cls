/**
 * A line of an order. Used both to request items and to return them.
 * Apex-defined type: structured input/output for Agentforce actions and Lightning Web Components.
 */
@JsonAccess(serializable='always' deserializable='always')
public with sharing class RestaurantOrderItem {
    @AuraEnabled @InvocableVariable(label='Menu Item Id' description='Menu item identifier from the menu')
    public String menuItemId;

    @AuraEnabled @InvocableVariable(label='Name' description='Dish name (response)')
    public String name;

    @AuraEnabled @InvocableVariable(label='Quantity' description='Quantity, 1 to 50')
    public Integer quantity;

    @AuraEnabled @InvocableVariable(label='Notes' description='Customization or special instructions for this item')
    public String notes;

    @AuraEnabled @InvocableVariable(label='Unit Price' description='Unit price in rupees (response)')
    public Decimal unitPrice;

    @AuraEnabled @InvocableVariable(label='Line Total' description='Line total in rupees (response)')
    public Decimal lineTotal;
}
