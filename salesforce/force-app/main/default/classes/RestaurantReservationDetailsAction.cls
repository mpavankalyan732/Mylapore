/** Agentforce action: getReservation. Details of a reservation, after an ownership check on the phone number. */
public with sharing class RestaurantReservationDetailsAction {
    @JsonAccess(serializable='always' deserializable='always')
    public class Request {
        @InvocableVariable(required=true label='Reservation Id' description='The reservation id the customer was given.')
        public String reservationId;
        @InvocableVariable(required=true label='Customer Phone' description='The mobile number the reservation was made with.')
        public String customerPhone;
    }

    @JsonAccess(serializable='always' deserializable='always')
    public class Response {
        @InvocableVariable(label='Reservation' description='Reservation details. Check success before using it.')
        public RestaurantReservationResponse reservation;
    }

    @InvocableMethod(
        label='Get Reservation'
        description='Retrieves the date, time, party size and status of an existing reservation. Requires the reservation id and the phone number used.'
        category='Restaurant'
    )
    public static List<Response> getReservation(List<Request> requests) {
        List<Response> out = new List<Response>();
        for (Request r : requests) {
            Response resp = new Response();
            try {
                resp.reservation = RestaurantApiService.getReservation(r.reservationId, r.customerPhone);
            } catch (RestaurantApiException e) {
                resp.reservation = RestaurantErrors.reservation(e);
            }
            out.add(resp);
        }
        return out;
    }
}
