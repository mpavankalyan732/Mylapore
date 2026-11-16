/**
 * Converts RestaurantApiException to an AuraHandledException for Lightning Web Components.
 * The message is a small JSON document so the component can react to specific cases,
 * e.g. {"code":"ITEM_UNAVAILABLE","message":"...","itemIds":["..."]}.
 * Components must fall back to showing the raw message if it is not JSON.
 */
public with sharing class RestaurantAuraSupport {
    public static AuraHandledException toAura(RestaurantApiException e) {
        Map<String, Object> payload = new Map<String, Object>{
            'code' => e.errorCode,
            'message' => e.getMessage(),
            'itemIds' => RestaurantApiMapper.strings(e.details, 'itemIds')
        };
        AuraHandledException a = new AuraHandledException(e.getMessage());
        a.setMessage(JSON.serialize(payload)); // also makes getMessage() meaningful in tests
        return a;
    }

    public static AuraHandledException plain(String message) {
        AuraHandledException a = new AuraHandledException(message);
        a.setMessage(JSON.serialize(new Map<String, Object>{ 'code' => 'VALIDATION_ERROR', 'message' => message }));
        return a;
    }
}
