/**
 * Webhook Service - Type Definitions
 * Event registration, delivery tracking, and signature verification
 */

/**
 * Supported webhook event types
 */
export type WebhookEventType = 'task.retry' | 'schedule.executed' | 'error.recovered';

/**
 * Webhook delivery status
 */
export enum WebhookDeliveryStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  RETRYING = 'retrying',
}

/**
 * Webhook configuration entity
 */
export interface Webhook {
  id: string;
  eventType: WebhookEventType;
  url: string;
  headers?: Record<string, string>;
  enabled: boolean;
  retryPolicy: WebhookRetryPolicy;
  secret?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Webhook delivery attempt record
 */
export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventType: WebhookEventType;
  eventData: Record<string, unknown>;
  status: WebhookDeliveryStatus;
  statusCode?: number;
  responseBody?: string;
  error?: string;
  attemptNumber: number;
  nextRetryAt?: Date;
  sentAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Webhook retry policy
 */
export interface WebhookRetryPolicy {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Webhook creation request
 */
export interface CreateWebhookRequest {
  eventType: WebhookEventType;
  url: string;
  headers?: Record<string, string>;
  enabled?: boolean;
  retryPolicy?: Partial<WebhookRetryPolicy>;
  secret?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Webhook update request
 */
export interface UpdateWebhookRequest {
  url?: string;
  headers?: Record<string, string>;
  enabled?: boolean;
  retryPolicy?: Partial<WebhookRetryPolicy>;
  secret?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Webhook filter options
 */
export interface WebhookFilterOptions {
  eventType?: WebhookEventType;
  enabled?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Webhook delivery filter options
 */
export interface WebhookDeliveryFilterOptions {
  webhookId?: string;
  status?: WebhookDeliveryStatus;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
  page?: number;
}

/**
 * Webhook event payload
 */
export interface WebhookEvent {
  id: string;
  eventType: WebhookEventType;
  timestamp: Date;
  data: Record<string, unknown>;
}

/**
 * Webhook service interface
 */
export interface IWebhookService {
  registerWebhook(request: CreateWebhookRequest): Promise<Webhook>;
  getWebhook(id: string): Promise<Webhook | null>;
  listWebhooks(filter?: WebhookFilterOptions): Promise<Webhook[]>;
  updateWebhook(id: string, request: UpdateWebhookRequest): Promise<Webhook>;
  deleteWebhook(id: string): Promise<void>;
  triggerEvent(event: WebhookEvent): Promise<void>;
  getDeliveries(webhookId: string, filter?: WebhookDeliveryFilterOptions): Promise<WebhookDelivery[]>;
  getDelivery(id: string): Promise<WebhookDelivery | null>;
  retryDelivery(deliveryId: string): Promise<WebhookDelivery>;
}

/**
 * Webhook database interface (abstraction)
 */
export interface WebhookDatabase {
  saveWebhook(webhook: Webhook): Promise<Webhook>;
  getWebhook(id: string): Promise<Webhook | null>;
  listWebhooks(filter?: WebhookFilterOptions): Promise<Webhook[]>;
  updateWebhook(id: string, updates: Partial<Webhook>): Promise<Webhook>;
  deleteWebhook(id: string): Promise<void>;
  saveDelivery(delivery: WebhookDelivery): Promise<WebhookDelivery>;
  getDelivery(id: string): Promise<WebhookDelivery | null>;
  listDeliveries(filter?: WebhookDeliveryFilterOptions): Promise<WebhookDelivery[]>;
  updateDelivery(id: string, updates: Partial<WebhookDelivery>): Promise<WebhookDelivery>;
}

/**
 * HTTP client interface for webhook delivery
 */
export interface HttpClient {
  post(url: string, data: Record<string, unknown>, options?: HttpClientOptions): Promise<HttpResponse>;
}

/**
 * HTTP client options
 */
export interface HttpClientOptions {
  headers?: Record<string, string>;
  timeout?: number;
}

/**
 * HTTP response
 */
export interface HttpResponse {
  statusCode: number;
  body: string;
  headers: Record<string, string>;
}
