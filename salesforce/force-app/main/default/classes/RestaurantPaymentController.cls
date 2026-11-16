public with sharing class RestaurantPaymentController {

    @AuraEnabled
    public static String createPaymentLink(String cartJson) {

        if (String.isBlank(cartJson)) {
            throw new AuraHandledException(
                'Cart cannot be empty.'
            );
        }

        try {

            List<Object> items =
                (List<Object>) JSON.deserializeUntyped(cartJson);

            if (items.isEmpty()) {
                throw new AuraHandledException(
                    'Please add items to your cart.'
                );
            }

            HttpRequest request = new HttpRequest();

            request.setEndpoint(
                'callout:Restaurant_API/payments/create-link'
            );

            request.setMethod('POST');

            request.setHeader(
                'Content-Type',
                'application/json'
            );

            request.setTimeout(20000);

            request.setBody(
                JSON.serialize(
                    new Map<String, Object>{
                        'items' => items
                    }
                )
            );

            Http http = new Http();

            HttpResponse response = http.send(request);

            if (
                response.getStatusCode() != 200 &&
                response.getStatusCode() != 201
            ) {
                throw new AuraHandledException(
                    'Unable to create Razorpay payment session.'
                );
            }

            Map<String, Object> result =
                (Map<String, Object>) JSON.deserializeUntyped(
                    response.getBody()
                );

            String checkoutUrl =
                (String) result.get('checkoutUrl');

            if (
                String.isBlank(checkoutUrl) ||
                !checkoutUrl.startsWith('https://rzp.io/')
            ) {
                throw new AuraHandledException(
                    'Invalid payment URL.'
                );
            }

            return checkoutUrl;

        } catch (Exception ex) {

            throw new AuraHandledException(
                'Payment initialization failed: ' +
                ex.getMessage()
            );
        }
    }
}