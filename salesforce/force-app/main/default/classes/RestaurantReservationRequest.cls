/**
 * Request to reserve a table.
 * Apex-defined type: structured input/output for Agentforce actions and Lightning Web Components.
 */
@JsonAccess(serializable='always' deserializable='always')
public with sharing class RestaurantReservationRequest {
    @AuraEnabled @InvocableVariable(label='Customer Name' description='Customer name')
    public String customerName;

    @AuraEnabled @InvocableVariable(label='Customer Phone' description='Customer Indian mobile number')
    public String customerPhone;

    @AuraEnabled @InvocableVariable(label='Party Size' description='Number of guests, 1 to 60')
    public Integer partySize;

    @AuraEnabled @InvocableVariable(label='Starts At' description='Reservation date and time, ISO-8601 with time zone, e.g. 2026-12-01T19:30:00+05:30')
    public String startsAt;

    @AuraEnabled @InvocableVariable(label='Notes' description='Special requests')
    public String notes;
}
