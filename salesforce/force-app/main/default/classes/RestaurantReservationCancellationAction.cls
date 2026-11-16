/** Agentforce action: cancelReservation. Cancels a future reservation only after explicit customer confirmation. */
public with sharing class RestaurantReservationCancellationAction {
    @JsonAccess(serializable='always' deserializable='always')
    public class Request {
        @InvocableVariable(required=true label='Reservation Id' description='The reservation id the customer was given.')
        public String reservationId;
        @InvocableVariable(required=true label='Customer Phone' description='The mobile number the reservation was made with.')
        public String customerPhone;
        @InvocableVariable(required=true label='Customer Confirmed' description='Must be true only after the customer explicitly agreed to cancel.')
        public Boolean customerConfirmed;
    }

    @JsonAccess(serializable='always' deserializable='always')
    public class Response {
        @InvocableVariable(label='Reservation' description='The reservation is cancelled only when cancelled is true.')
        public RestaurantReservationResponse reservation;
    }

    @InvocableMethod(
        label='Cancel Reservation'
        description='Cancels a future reservation. Get an explicit yes first. Never say it is cancelled unless cancelled is true.'
        category='Restaurant'
    )
    public static List<Response> cancelReservation(List<Request> requests) {
        List<Response> out = new List<Response>();
        for (Request r : requests) {
            Response resp = new Response();
            if (r.customerConfirmed != true) {
                resp.reservation = new RestaurantReservationResponse();
                resp.reservation.success = false;
                resp.reservation.cancelled = false;
                resp.reservation.code = 'CONFIRMATION_REQUIRED';
                resp.reservation.message = 'The reservation was not cancelled because the customer has not explicitly confirmed.';
            } else {
                try {
                    resp.reservation = RestaurantApiService.cancelReservation(r.reservationId, r.customerPhone);
                } catch (RestaurantApiException e) {
                    resp.reservation = RestaurantErrors.reservation(e);
                }
            }
            out.add(resp);
        }
        return out;
    }
}
