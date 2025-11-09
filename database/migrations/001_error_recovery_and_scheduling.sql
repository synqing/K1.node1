-- Migration: Error Recovery and Scheduling Schema
-- Created: 2025-11-10
-- Purpose: Tables for retry logic, circuit breaker state management, dead letter queue, and job scheduling

BEGIN;

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE retry_status AS ENUM ('pending', 'success', 'failed');
CREATE TYPE circuit_breaker_state AS ENUM ('closed', 'open', 'half_open');
CREATE TYPE execution_status AS ENUM ('running', 'success', 'failed');

-- ============================================================================
-- TABLES
-- ============================================================================

-- Table: retry_attempts
-- Purpose: Track individual retry attempts for failed tasks
CREATE TABLE retry_attempts (
  id BIGSERIAL PRIMARY KEY,
  task_id VARCHAR(255) NOT NULL,
  attempt_number INTEGER NOT NULL,
  error_message TEXT,
  retry_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status retry_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT retry_attempts_positive_attempt CHECK (attempt_number > 0)
);

CREATE INDEX idx_retry_attempts_task_id ON retry_attempts (task_id);
CREATE INDEX idx_retry_attempts_status ON retry_attempts (status);
CREATE INDEX idx_retry_attempts_retry_at ON retry_attempts (retry_at);

-- Table: circuit_breaker_states
-- Purpose: Manage circuit breaker state for external service dependencies
CREATE TABLE circuit_breaker_states (
  id BIGSERIAL PRIMARY KEY,
  service_name VARCHAR(255) NOT NULL UNIQUE,
  state circuit_breaker_state NOT NULL DEFAULT 'closed',
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_failure_at TIMESTAMP WITH TIME ZONE,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT circuit_breaker_failure_count_non_negative CHECK (failure_count >= 0)
);

CREATE INDEX idx_circuit_breaker_service ON circuit_breaker_states (service_name);
CREATE INDEX idx_circuit_breaker_state ON circuit_breaker_states (state);
CREATE INDEX idx_circuit_breaker_next_retry ON circuit_breaker_states (next_retry_at);

-- Table: dead_letter_queue
-- Purpose: Store tasks that have exhausted retry attempts or encountered fatal errors
CREATE TABLE dead_letter_queue (
  id BIGSERIAL PRIMARY KEY,
  task_id VARCHAR(255) NOT NULL,
  task_definition JSONB NOT NULL,
  error_details JSONB NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  CONSTRAINT dead_letter_queue_non_negative_retries CHECK (retry_count >= 0)
);

CREATE INDEX idx_dead_letter_queue_task_id ON dead_letter_queue (task_id);
CREATE INDEX idx_dead_letter_queue_added_at ON dead_letter_queue (added_at);
CREATE INDEX idx_dead_letter_queue_resolved ON dead_letter_queue (resolved_at);

-- Table: schedules
-- Purpose: Manage scheduled workflow execution definitions
CREATE TABLE schedules (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  cron_expression VARCHAR(255) NOT NULL,
  workflow_id VARCHAR(255) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_execution_at TIMESTAMP WITH TIME ZONE,
  next_execution_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_schedules_workflow_id ON schedules (workflow_id);
CREATE INDEX idx_schedules_enabled ON schedules (enabled);
CREATE INDEX idx_schedules_next_execution ON schedules (next_execution_at);

-- Table: execution_history
-- Purpose: Track execution history of scheduled jobs
CREATE TABLE execution_history (
  id BIGSERIAL PRIMARY KEY,
  schedule_id BIGINT NOT NULL REFERENCES schedules (id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  status execution_status NOT NULL,
  error_message TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT execution_history_time_order CHECK (completed_at IS NULL OR completed_at >= started_at),
  CONSTRAINT execution_history_duration_non_negative CHECK (execution_time_ms IS NULL OR execution_time_ms >= 0)
);

CREATE INDEX idx_execution_history_schedule_id ON execution_history (schedule_id);
CREATE INDEX idx_execution_history_status ON execution_history (status);
CREATE INDEX idx_execution_history_started_at ON execution_history (started_at);

-- ============================================================================
-- COMMIT
-- ============================================================================

COMMIT;
