/**
 * Dashboard Layout Component
 * Provides the main layout structure for the dashboard
 * Includes header, sidebar, main content area, and footer
 */

import React, { useState } from 'react';
import './DashboardLayout.css';

interface DashboardLayoutProps {
  state: any;
  data: any;
  isLoading: boolean;
  hasError: boolean;
  onStateChange?: (newState: any) => void;
  children?: React.ReactNode;
}

/**
 * DashboardLayout - Main layout container component
 *
 * Structure:
 * - Header: Navigation and title bar
 * - Sidebar: Main navigation menu
 * - Main Content: Primary content area with panels/widgets
 * - Footer: Status bar and additional information
 *
 * Features:
 * - Responsive design with collapsible sidebar
 * - Loading and error state handling
 * - Flexible content area for various dashboard views
 */
export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  state,
  data,
  isLoading,
  hasError,
  onStateChange,
  children,
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const connectionStatus = data?.connection?.websocketConnected ? 'connected' : 'disconnected';
  const errorCount = Object.values(data?.errors || {}).filter(Boolean).length;

  return (
    <div className="dashboard-layout">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <button
            className="sidebar-toggle"
            onClick={toggleSidebar}
            aria-label="Toggle sidebar"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span className="hamburger-icon">
              <span></span>
              <span></span>
              <span></span>
            </span>
          </button>

          <h1 className="dashboard-title">Dashboard</h1>

          <div className="header-status">
            <span className={`connection-indicator ${connectionStatus}`} title={`WebSocket ${connectionStatus}`}>
              <span className="status-dot"></span>
              {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
            </span>

            {errorCount > 0 && (
              <span className="error-indicator" title={`${errorCount} error(s) detected`}>
                <span className="error-badge">{errorCount}</span>
                Errors
              </span>
            )}

            {isLoading && (
              <span className="loading-indicator" title="Loading data...">
                <span className="spinner"></span>
                Loading
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="dashboard-body">
        {/* Sidebar */}
        <aside className={`dashboard-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <nav className="sidebar-nav">
            <div className="nav-section">
              <h2 className="nav-title">Monitoring</h2>
              <ul className="nav-list">
                <li className="nav-item">
                  <a href="#error-recovery" className="nav-link">
                    <span className="nav-icon">⚠️</span>
                    <span className="nav-label">Error Recovery</span>
                  </a>
                </li>
                <li className="nav-item">
                  <a href="#scheduling" className="nav-link">
                    <span className="nav-icon">⏱️</span>
                    <span className="nav-label">Scheduling</span>
                  </a>
                </li>
                <li className="nav-item">
                  <a href="#resources" className="nav-link">
                    <span className="nav-icon">📊</span>
                    <span className="nav-label">Resources</span>
                  </a>
                </li>
              </ul>
            </div>

            <div className="nav-section">
              <h2 className="nav-title">Tools</h2>
              <ul className="nav-list">
                <li className="nav-item">
                  <a href="#settings" className="nav-link">
                    <span className="nav-icon">⚙️</span>
                    <span className="nav-label">Settings</span>
                  </a>
                </li>
                <li className="nav-item">
                  <a href="#help" className="nav-link">
                    <span className="nav-icon">❓</span>
                    <span className="nav-label">Help</span>
                  </a>
                </li>
              </ul>
            </div>
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="dashboard-main">
          {children ? (
            children
          ) : (
            <div className="dashboard-content">
              {/* Loading State */}
              {isLoading && (
                <div className="loading-container">
                  <div className="spinner-large"></div>
                  <p>Loading dashboard data...</p>
                </div>
              )}

              {/* Error State */}
              {hasError && !isLoading && (
                <div className="error-container">
                  <div className="error-icon">⚠️</div>
                  <h2>Connection Error</h2>
                  <p>Failed to load dashboard data. Please check your connection and try again.</p>
                  {data?.errors?.websocket && (
                    <p className="error-message">{data.errors.websocket}</p>
                  )}
                  <button
                    className="retry-button"
                    onClick={() => window.location.reload()}
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Default Content */}
              {!isLoading && !hasError && (
                <div className="dashboard-panels">
                  {/* Error Recovery Panel */}
                  <section className="panel error-recovery-panel" id="error-recovery">
                    <h2 className="panel-title">Error Recovery</h2>
                    <div className="panel-content">
                      <div className="stat-card">
                        <span className="stat-label">Retry Stats</span>
                        <span className="stat-value">
                          {data?.errorRecovery?.retryStats?.total_attempts || 0}
                        </span>
                      </div>
                      <div className="stat-card">
                        <span className="stat-label">Circuit Breakers</span>
                        <span className="stat-value">
                          {data?.errorRecovery?.circuitBreakers?.size || 0}
                        </span>
                      </div>
                      <div className="stat-card">
                        <span className="stat-label">DLQ Entries</span>
                        <span className="stat-value">
                          {data?.errorRecovery?.dlqEntries?.length || 0}
                        </span>
                      </div>
                    </div>
                  </section>

                  {/* Scheduling Panel */}
                  <section className="panel scheduling-panel" id="scheduling">
                    <h2 className="panel-title">Scheduling</h2>
                    <div className="panel-content">
                      <div className="stat-card">
                        <span className="stat-label">Schedules</span>
                        <span className="stat-value">
                          {data?.scheduling?.schedules?.length || 0}
                        </span>
                      </div>
                      <div className="stat-card">
                        <span className="stat-label">Queued Tasks</span>
                        <span className="stat-value">
                          {data?.scheduling?.priorityQueue?.queued || 0}
                        </span>
                      </div>
                      <div className="stat-card">
                        <span className="stat-label">Executing</span>
                        <span className="stat-value">
                          {data?.scheduling?.priorityQueue?.executing || 0}
                        </span>
                      </div>
                    </div>
                  </section>

                  {/* Resources Panel */}
                  <section className="panel resources-panel" id="resources">
                    <h2 className="panel-title">Resources</h2>
                    <div className="panel-content">
                      <div className="stat-card">
                        <span className="stat-label">CPU Usage</span>
                        <span className="stat-value">
                          {data?.scheduling?.resourceUsage?.total_cpu_percent?.toFixed(1) || '0'}%
                        </span>
                      </div>
                      <div className="stat-card">
                        <span className="stat-label">Memory Usage</span>
                        <span className="stat-value">
                          {data?.scheduling?.resourceUsage?.total_memory_percent?.toFixed(1) || '0'}%
                        </span>
                      </div>
                      <div className="stat-card">
                        <span className="stat-label">Active Tasks</span>
                        <span className="stat-value">
                          {data?.scheduling?.resourceUsage?.concurrent_tasks || 0}
                        </span>
                      </div>
                    </div>
                  </section>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="dashboard-footer">
        <div className="footer-content">
          <span className="footer-info">
            Last updated: {new Date().toLocaleTimeString()}
          </span>
          <span className="footer-status">
            {data?.connection?.websocketConnected && '✓ Connected'}
            {!data?.connection?.websocketConnected && '✗ Disconnected'}
          </span>
        </div>
      </footer>
    </div>
  );
};

export default DashboardLayout;
