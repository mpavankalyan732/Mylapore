/**
 * Result of creating, reading or cancelling a reservation.
 * Apex-defined type: structured input/output for Agentforce actions and Lightning Web Components.
 */
@JsonAccess(serializable='always' deserializable='always')
public with sharing class RestaurantReservationResponse {
    @AuraEnabled @InvocableVariable(label='Success' description='True when the restaurant API call succeeded')
    public Boolean success;

    @AuraEnabled @InvocableVariable(label='Error Code' description='Machine-readable error code when success is false')
    public String errorCode;

    @AuraEnabled @InvocableVariable(label='Message' description='Human-readable result')
    public String message;

    @AuraEnabled @InvocableVariable(label='Reservation Id' description='Reservation identifier')
    public String reservationId;

    @AuraEnabled @InvocableVariable(label='Status' description='REQUESTED, CONFIRMED or CANCELLED')
    public String status;

    @AuraEnabled @InvocableVariable(label='Status Message' description='Plain-language status')
    public String statusMessage;

    @AuraEnabled @InvocableVariable(label='Party Size' description='Number of guests')
    public Integer partySize;

    @AuraEnabled @InvocableVariable(label='Starts At' description='ISO-8601 reservation time')
    public String startsAt;

    @AuraEnabled @InvocableVariable(label='Notes' description='Special requests')
    public String notes;

    @AuraEnabled @InvocableVariable(label='Customer Name' description='Customer name')
    public String customerName;

    @AuraEnabled @InvocableVariable(label='Cancelled' description='True only when a cancellation was confirmed by the backend')
    public Boolean cancelled;

    @AuraEnabled @InvocableVariable(label='Code' description='CANCELLED, ALREADY_CANCELLED or IN_THE_PAST for cancellations')
    public String code;
}
