-- Seed Data: Error Recovery and Scheduling Test Data
-- Created: 2025-11-10
-- Purpose: Sample data for testing error recovery, circuit breaker, and scheduling functionality

BEGIN;

-- ============================================================================
-- SCHEDULES
-- ============================================================================

INSERT INTO schedules (name, cron_expression, workflow_id, enabled, last_execution_at, next_execution_at) VALUES
('Daily Reconciliation', '0 2 * * *', 'wf_daily_reconciliation', true, '2025-11-09 02:15:30+00:00', '2025-11-10 02:00:00+00:00'),
('Hourly Status Check', '0 * * * *', 'wf_status_check', true, '2025-11-10 13:00:45+00:00', '2025-11-10 14:00:00+00:00'),
('Weekly Report Generation', '0 9 ? * MON', 'wf_report_gen', true, '2025-11-03 09:30:15+00:00', '2025-11-17 09:00:00+00:00'),
('Data Cleanup Job', '0 3 * * *', 'wf_cleanup', true, '2025-11-09 03:05:22+00:00', '2025-11-10 03:00:00+00:00'),
('Real-time Event Processor', '*/5 * * * *', 'wf_event_processor', true, '2025-11-10 13:55:02+00:00', '2025-11-10 14:00:00+00:00'),
('Monthly Archive', '0 0 1 * *', 'wf_archive', false, '2025-10-01 00:15:40+00:00', '2025-12-01 00:00:00+00:00'),
('Customer Notification Batch', '0 10 * * *', 'wf_notify_customers', true, '2025-11-09 10:22:18+00:00', '2025-11-10 10:00:00+00:00'),
('Inventory Sync', '*/30 * * * *', 'wf_inventory_sync', true, '2025-11-10 13:30:05+00:00', '2025-11-10 14:00:00+00:00'),
('Payment Processor', '0 */4 * * *', 'wf_payment_process', true, '2025-11-10 12:05:33+00:00', '2025-11-10 16:00:00+00:00'),
('System Health Check', '*/15 * * * *', 'wf_health_check', true, '2025-11-10 13:45:12+00:00', '2025-11-10 14:00:00+00:00'),
('Email Digest', '0 8 * * MON-FRI', 'wf_email_digest', true, '2025-11-07 08:30:19+00:00', '2025-11-11 08:00:00+00:00'),
('Cache Warming', '0 5 * * *', 'wf_cache_warm', true, '2025-11-09 05:12:44+00:00', '2025-11-10 05:00:00+00:00'),
('Audit Log Export', '0 1 * * SUN', 'wf_audit_export', true, '2025-11-02 01:25:31+00:00', '2025-11-09 01:00:00+00:00'),
('Rate Limit Reset', '0 0 * * *', 'wf_rate_limit_reset', true, '2025-11-09 00:05:27+00:00', '2025-11-10 00:00:00+00:00'),
('Session Cleanup', '0 4 * * *', 'wf_session_cleanup', true, '2025-11-09 04:18:55+00:00', '2025-11-10 04:00:00+00:00');

-- ============================================================================
-- EXECUTION_HISTORY
-- ============================================================================

INSERT INTO execution_history (schedule_id, started_at, completed_at, status, error_message, execution_time_ms) VALUES
(1, '2025-11-09 02:00:05+00:00', '2025-11-09 02:15:30+00:00', 'success', NULL, 915000),
(1, '2025-11-08 02:00:02+00:00', '2025-11-08 02:14:22+00:00', 'success', NULL, 860000),
(2, '2025-11-10 13:00:03+00:00', '2025-11-10 13:00:45+00:00', 'success', NULL, 42000),
(2, '2025-11-10 12:00:01+00:00', '2025-11-10 12:00:38+00:00', 'success', NULL, 37000),
(3, '2025-11-03 09:00:10+00:00', '2025-11-03 09:30:15+00:00', 'success', NULL, 1805000),
(4, '2025-11-09 03:00:04+00:00', '2025-11-09 03:05:22+00:00', 'success', NULL, 318000),
(5, '2025-11-10 13:55:00+00:00', '2025-11-10 13:55:02+00:00', 'success', NULL, 2000),
(5, '2025-11-10 13:50:00+00:00', '2025-11-10 13:50:01+00:00', 'success', NULL, 1500),
(6, '2025-10-01 00:00:08+00:00', '2025-10-01 00:15:40+00:00', 'failed', 'Database connection timeout after 15 minutes', NULL),
(7, '2025-11-09 10:00:05+00:00', '2025-11-09 10:22:18+00:00', 'success', NULL, 1333000),
(8, '2025-11-10 13:30:02+00:00', '2025-11-10 13:30:05+00:00', 'success', NULL, 3000),
(8, '2025-11-10 13:00:01+00:00', '2025-11-10 13:00:04+00:00', 'success', NULL, 3000),
(9, '2025-11-10 12:00:06+00:00', '2025-11-10 12:05:33+00:00', 'success', NULL, 327000),
(10, '2025-11-10 13:45:02+00:00', '2025-11-10 13:45:12+00:00', 'success', NULL, 10000),
(11, '2025-11-07 08:00:04+00:00', '2025-11-07 08:30:19+00:00', 'success', NULL, 1815000);

-- ============================================================================
-- RETRY_ATTEMPTS
-- ============================================================================

INSERT INTO retry_attempts (task_id, attempt_number, error_message, retry_at, status) VALUES
('task_payment_001', 1, 'Connection refused to payment gateway', '2025-11-10 14:05:00+00:00', 'pending'),
('task_payment_001', 2, 'Connection refused to payment gateway', '2025-11-10 14:15:00+00:00', 'pending'),
('task_email_batch_042', 1, 'SMTP timeout', '2025-11-10 14:08:30+00:00', 'pending'),
('task_api_sync_015', 1, 'Rate limit exceeded', '2025-11-10 14:10:00+00:00', 'pending'),
('task_api_sync_015', 2, 'Rate limit exceeded', '2025-11-10 14:20:00+00:00', 'success'),
('task_cache_update_789', 1, 'Redis connection pool exhausted', '2025-11-10 14:02:15+00:00', 'success'),
('task_notification_001', 1, 'Customer service unavailable', '2025-11-10 14:12:00+00:00', 'failed'),
('task_notification_001', 2, 'Customer service unavailable', '2025-11-10 14:22:00+00:00', 'failed'),
('task_notification_001', 3, 'Customer service unavailable', '2025-11-10 14:32:00+00:00', 'failed'),
('task_inventory_sync_003', 1, 'Inventory service responding slowly', '2025-11-10 14:06:45+00:00', 'success'),
('task_report_gen_101', 1, 'Insufficient disk space', '2025-11-10 14:09:00+00:00', 'pending'),
('task_cleanup_db_456', 1, 'Table lock timeout', '2025-11-10 14:03:30+00:00', 'success'),
('task_export_audit_567', 1, 'S3 upload failed', '2025-11-10 14:07:20+00:00', 'pending'),
('task_archive_data_012', 1, 'Archive service unavailable', '2025-11-10 13:58:00+00:00', 'failed'),
('task_session_clear_999', 1, 'Database lock', '2025-11-10 14:01:15+00:00', 'success');

-- ============================================================================
-- CIRCUIT_BREAKER_STATES
-- ============================================================================

INSERT INTO circuit_breaker_states (service_name, state, failure_count, last_failure_at, next_retry_at) VALUES
('payment_gateway_api', 'open', 5, '2025-11-10 14:04:15+00:00', '2025-11-10 14:09:15+00:00'),
('customer_service_api', 'open', 3, '2025-11-10 14:03:45+00:00', '2025-11-10 14:33:45+00:00'),
('email_service_smtp', 'half_open', 2, '2025-11-10 13:58:20+00:00', '2025-11-10 14:08:20+00:00'),
('inventory_sync_api', 'closed', 0, NULL, NULL),
('s3_bucket_api', 'half_open', 1, '2025-11-10 14:02:10+00:00', '2025-11-10 14:07:10+00:00'),
('redis_cache', 'closed', 0, NULL, NULL),
('database_primary', 'closed', 0, NULL, NULL),
('audit_log_service', 'open', 2, '2025-11-10 14:01:00+00:00', '2025-11-10 14:06:00+00:00'),
('notification_service', 'half_open', 1, '2025-11-10 13:52:30+00:00', '2025-11-10 14:02:30+00:00'),
('analytics_engine', 'closed', 0, NULL, NULL);

-- ============================================================================
-- DEAD_LETTER_QUEUE
-- ============================================================================

INSERT INTO dead_letter_queue (task_id, task_definition, error_details, retry_count, added_at, resolved_at, resolution_notes) VALUES
(
  'task_notification_001',
  '{"type": "send_notification", "customer_id": 12345, "channel": "email", "template": "welcome", "priority": "high"}',
  '{"error": "Customer service unavailable", "code": "SERVICE_UNAVAILABLE", "attempts": 3, "last_error_time": "2025-11-10T14:32:00Z"}',
  3,
  '2025-11-10 14:00:15+00:00',
  NULL,
  NULL
),
(
  'task_archive_data_012',
  '{"type": "archive_data", "date_range": "2025-10-01 to 2025-10-31", "target": "cold_storage", "compression": "gzip"}',
  '{"error": "Archive service unavailable", "code": "SERVICE_DOWN", "http_status": 503, "last_error_time": "2025-11-10T13:58:00Z"}',
  2,
  '2025-11-10 13:55:00+00:00',
  NULL,
  NULL
),
(
  'task_payment_old_001',
  '{"type": "process_payment", "order_id": 98765, "amount": 299.99, "currency": "USD", "method": "credit_card"}',
  '{"error": "Payment gateway permanently disabled", "code": "GATEWAY_DEPRECATED", "retirement_date": "2025-09-30"}',
  5,
  '2025-11-08 10:00:00+00:00',
  '2025-11-09 15:30:00+00:00',
  'Migrated to new payment gateway. Task resubmitted with updated configuration.'
),
(
  'task_report_gen_corrupted',
  '{"type": "generate_report", "report_id": 55555, "format": "pdf", "data_source": "analytics_db", "filters": {}}',
  '{"error": "Data corruption detected", "code": "DATA_INTEGRITY_ERROR", "affected_columns": ["revenue", "user_count"]}',
  4,
  '2025-11-07 08:30:00+00:00',
  '2025-11-09 11:45:00+00:00',
  'Database was recovered from backup. Data validated and report regenerated successfully.'
),
(
  'task_export_legacy_001',
  '{"type": "export_data", "format": "xml", "target": "ftp", "legacy_system": true}',
  '{"error": "FTP service deprecated", "code": "DEPRECATED_PROTOCOL", "replacement": "SFTP"}',
  6,
  '2025-11-06 12:00:00+00:00',
  '2025-11-08 09:20:00+00:00',
  'Updated export configuration to use SFTP. All exports now use secure protocol.'
),
(
  'task_cleanup_db_old',
  '{"type": "cleanup_old_records", "table": "user_sessions", "age_days": 30, "batch_size": 10000}',
  '{"error": "Table structure changed", "code": "SCHEMA_MISMATCH", "expected_columns": 15, "actual_columns": 18}',
  1,
  '2025-11-05 04:15:00+00:00',
  '2025-11-05 14:00:00+00:00',
  'Updated cleanup script to handle new schema. Task resubmitted and completed.'
),
(
  'task_sync_third_party_001',
  '{"type": "sync_external_data", "provider": "legacy_crm", "endpoint": "https://legacy.crm.local/api/v1/data"}',
  '{"error": "Third party system shut down", "code": "EXTERNAL_SERVICE_OFFLINE", "last_available": "2025-08-31"}',
  10,
  '2025-11-01 06:00:00+00:00',
  '2025-11-02 16:30:00+00:00',
  'Migrated to new CRM system. Data has been imported and validation passed.'
),
(
  'task_batch_process_001',
  '{"type": "batch_process", "input_file": "s3://bucket/data_2025_11_10.csv", "processor": "ml_model_v2", "output_format": "parquet"}',
  '{"error": "File format incompatible with processor", "code": "INCOMPATIBLE_FORMAT", "expected": "parquet", "received": "csv"}',
  8,
  '2025-11-04 16:00:00+00:00',
  NULL,
  NULL
);

-- ============================================================================
-- COMMIT
-- ============================================================================

COMMIT;
