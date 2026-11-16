/** Agentforce action: createReservation. Creates a table reservation REQUEST (the restaurant confirms it). */
public with sharing class RestaurantReservationAction {
    @JsonAccess(serializable='always' deserializable='always')
    public class Request {
        @InvocableVariable(required=true label='Reservation Request' description='Customer name, mobile number, number of guests (1-60), date and time as ISO-8601 with time zone, and optional notes.')
        public RestaurantReservationRequest reservation;
        @InvocableVariable(required=true label='Customer Confirmed' description='Must be true only after the customer confirmed the date, time and number of guests.')
        public Boolean customerConfirmed;
    }

    @JsonAccess(serializable='always' deserializable='always')
    public class Response {
        @InvocableVariable(label='Reservation' description='The reservation exists only when success is true and reservationId is set.')
        public RestaurantReservationResponse reservation;
    }

    @InvocableMethod(
        label='Create Reservation'
        description='Requests a table reservation. Returns the real reservation id and status. Never claim a reservation was made unless success is true. The restaurant confirms requests.'
        category='Restaurant'
    )
    public static List<Response> createReservation(List<Request> requests) {
        List<Response> out = new List<Response>();
        for (Request r : requests) {
            Response resp = new Response();
            if (r.customerConfirmed != true) {
                resp.reservation = new RestaurantReservationResponse();
                resp.reservation.success = false;
                resp.reservation.errorCode = 'CONFIRMATION_REQUIRED';
                resp.reservation.message = 'The reservation was not made because the customer has not confirmed the details.';
            } else {
                try {
                    resp.reservation = RestaurantApiService.createReservation(r.reservation);
                } catch (RestaurantApiException e) {
                    resp.reservation = RestaurantErrors.reservation(e);
                }
            }
            out.add(resp);
        }
        return out;
    }
}
