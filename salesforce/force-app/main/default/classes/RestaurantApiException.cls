/**
 * Raised when the restaurant API cannot be reached or answers with an error.
 * getMessage() is always safe to show to a customer (no URLs, keys or stack traces).
 */
public class RestaurantApiException extends Exception {
    /** HTTP status code, or 0 when the API could not be reached at all. */
    public Integer statusCode;
    /** Machine-readable code, e.g. ITEM_UNAVAILABLE, DELIVERY_OUT_OF_AREA, NOT_FOUND, UNREACHABLE. */
    public String errorCode;
    /** Apex exception type for diagnostics; not included in the customer-facing message. */
    public String errorType;
    /** Extra fields from the error body, e.g. itemIds for ITEM_UNAVAILABLE. */
    public Map<String, Object> details = new Map<String, Object>();

    public RestaurantApiException(Integer statusCode, String errorCode, String message) {
        this(message);
        this.statusCode = statusCode;
        this.errorCode = errorCode;
    }

    /** Builds an exception from a parsed error body such as {"statusCode":409,"code":"ITEM_UNAVAILABLE","message":"..."}. */
    public static RestaurantApiException fromResponse(Integer status, Map<String, Object> body) {
        String code = RestaurantApiMapper.str(body, 'code');
        if (String.isBlank(code)) {
            code = defaultCode(status);
        }
        String message = messageFrom(body, status);
        RestaurantApiException e = new RestaurantApiException(status, code, message);
        if (body != null) {
            e.details = body;
        }
        return e;
    }

    @TestVisible
    private static String defaultCode(Integer status) {
        if (status == 400) {
            return 'VALIDATION_ERROR';
        }
        if (status == 401 || status == 403) {
            return 'UNAUTHORIZED';
        }
        if (status == 404) {
            return 'NOT_FOUND';
        }
        if (status == 409) {
            return 'CONFLICT';
        }
        if (status == 422) {
            return 'UNPROCESSABLE';
        }
        if (status == 429) {
            return 'RATE_LIMITED';
        }
        return status >= 500 ? 'SERVER_ERROR' : 'HTTP_' + status;
    }

    @TestVisible
    private static String messageFrom(Map<String, Object> body, Integer status) {
        if (status == 401 || status == 403) {
            // Never echo authentication details.
            return 'The restaurant system rejected the request (not authorised). Please contact the restaurant.';
        }
        Object m = body == null ? null : body.get('message');
        if (m instanceof List<Object>) {
            List<String> parts = new List<String>();
            for (Object o : (List<Object>) m) {
                parts.add(String.valueOf(o));
            }
            return String.join(parts, '; ');
        }
        if (m != null && String.isNotBlank(String.valueOf(m))) {
            return String.valueOf(m);
        }
        if (status == 429) {
            return 'Too many requests. Please try again in a minute.';
        }
        if (status >= 500) {
            return 'The restaurant system had a problem. Please try again shortly.';
        }
        return 'The restaurant system could not complete the request (HTTP ' + status + ').';
    }
}
