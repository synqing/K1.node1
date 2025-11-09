/**
 * Dashboard Page Component
 * Main entry point for the dashboard application
 * Orchestrates layout, data fetching, and component composition
 */

import React, { useEffect } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { useDashboardState } from '../hooks/useDashboardState';
import { useErrorRecoveryMetrics, useSchedulingMetrics, useWebSocket } from '../hooks/useDashboard';
import { DashboardState } from '../types/dashboard';

/**
 * Dashboard - Main dashboard page component
 * Provides layout structure and manages dashboard state
 *
 * Responsibilities:
 * - Setup page-level state and hooks
 * - Manage dashboard lifecycle (data fetching, WebSocket)
 * - Pass state and handlers to layout component
 * - Handle loading and error states
 */
export const Dashboard: React.FC = () => {
  // State management hooks
  const dashboardState = useDashboardState();
  const { retryStats, circuitBreakers, dlqEntries, loading: recoveryLoading, error: recoveryError } = useErrorRecoveryMetrics(true, 5000);
  const { schedules, queue, resourceUsage, loading: schedulingLoading, error: schedulingError } = useSchedulingMetrics(true, 5000);
  const { connected: wsConnected, error: wsError } = useWebSocket(true);

  // Fetch initial data on mount
  useEffect(() => {
    // Initial state setup can happen here if needed
    console.debug('Dashboard mounted - WebSocket connected:', wsConnected);
  }, [wsConnected]);

  // Combine loading states
  const isLoading = recoveryLoading || schedulingLoading;
  const hasError = recoveryError || schedulingError || wsError;

  // Prepare dashboard data object
  const dashboardData = {
    errorRecovery: {
      retryStats,
      circuitBreakers,
      dlqEntries,
    },
    scheduling: {
      schedules,
      priorityQueue: queue,
      resourceUsage,
    },
    connection: {
      websocketConnected: wsConnected,
      lastError: wsError || null,
    },
    loading: {
      errorRecovery: recoveryLoading,
      scheduling: schedulingLoading,
    },
    errors: {
      errorRecovery: recoveryError,
      scheduling: schedulingError,
      websocket: wsError,
    },
  };

  return (
    <DashboardLayout
      state={dashboardState}
      data={dashboardData}
      isLoading={isLoading}
      hasError={hasError}
      onStateChange={dashboardState.setState}
    />
  );
};

export default Dashboard;
