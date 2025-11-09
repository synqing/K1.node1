/**
 * Webhook Service - Type Definitions
 * Event registration, delivery tracking, and signature verification
 */
/**
 * Webhook delivery status
 */
export var WebhookDeliveryStatus;
(function (WebhookDeliveryStatus) {
    WebhookDeliveryStatus["PENDING"] = "pending";
    WebhookDeliveryStatus["SUCCESS"] = "success";
    WebhookDeliveryStatus["FAILED"] = "failed";
    WebhookDeliveryStatus["RETRYING"] = "retrying";
})(WebhookDeliveryStatus || (WebhookDeliveryStatus = {}));
//# sourceMappingURL=webhook.types.js.map