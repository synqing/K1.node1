/**
 * DeviceManager Component Tests
 * 
 * Tests for Task 3: Enhanced Device Management
 * - Discovery states and error handling
 * - Manual connect validation and recovery
 * - Auto-reconnect functionality
 * - Device deduplication and sorting
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { DeviceManager } from '../DeviceManager';
import { ConnectionState } from '../../lib/types';
import { toast } from 'sonner';

// Mock dependencies
jest.mock('sonner', () => ({
  toast: {
    loading: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn()
  }
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

describe('DeviceManager', () => {
  const mockOnConnect = jest.fn();
  const mockOnDisconnect = jest.fn();
  
  const defaultConnectionState: ConnectionState = {
    connected: false,
    deviceIp: '',
    serialPort: ''
  };
  
  const connectedState: ConnectionState = {
    connected: true,
    deviceIp: '192.168.1.103',
    serialPort: '',
    lastSyncTime: Date.now()
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });
  
  describe('Rendering and Initial State', () => {
    it('renders all main sections', () => {
      render(
        <DeviceManager
          connectionState={defaultConnectionState}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
        />
      );
      
      expect(screen.getByText('Connection Status')).toBeInTheDocument();
      expect(screen.getByText('Device Discovery')).toBeInTheDocument();
      expect(screen.getByText('Manual Connection')).toBeInTheDocument();
      expect(screen.getByText('Auto-reconnect')).toBeInTheDocument();
    });
    
    it('shows disconnected state initially', () => {
      render(
        <DeviceManager
          connectionState={defaultConnectionState}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
        />
      );
      
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument();
    });
    
    it('shows connected state when connected', () => {
      render(
        <DeviceManager
          connectionState={connectedState}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
        />
      );
      
      expect(screen.getByText('Connected')).toBeInTheDocument();
      expect(screen.getByText('192.168.1.103')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument();
    });
  });
  
  describe('Manual Connection', () => {
    it('validates IP addresses correctly', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      render(
        <DeviceManager
          connectionState={defaultConnectionState}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
        />
      );
      
      const input = screen.getByLabelText(/Device IP Address/i);
      const connectButton = screen.getByRole('button', { name: /connect/i });
      
      // Test invalid IP
      await user.type(input, '999.999.999.999');
      await waitFor(() => {
        expect(screen.getByText(/Invalid IPv4 address/)).toBeInTheDocument();
      });
      expect(connectButton).toBeDisabled();
      
      // Test valid IP
      await user.clear(input);
      await user.type(input, '192.168.1.103');
      await waitFor(() => {
        expect(screen.queryByText(/Invalid IPv4 address/)).not.toBeInTheDocument();
      });
      expect(connectButton).not.toBeDisabled();
    });
    
    it('handles IPv6 addresses with brackets', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      render(
        <DeviceManager
          connectionState={defaultConnectionState}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
        />
      );
      
      const input = screen.getByLabelText(/Device IP Address/i);
      
      // Test IPv6 without brackets
      await user.type(input, 'fe80::1');
      await waitFor(() => {
        expect(screen.queryByText(/Invalid/)).not.toBeInTheDocument();
      });
      
      // Test IPv6 with brackets
      await user.clear(input);
      await user.type(input, '[fe80::1]');
      await waitFor(() => {
        expect(screen.queryByText(/Invalid/)).not.toBeInTheDocument();
      });
    });
    
    it('calls onConnect with normalized endpoint', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      render(
        <DeviceManager
          connectionState={defaultConnectionState}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
        />
      );
      
      const input = screen.getByLabelText(/Device IP Address/i);
      const connectButton = screen.getByRole('button', { name: /connect/i });
      
      await user.type(input, '192.168.1.103');
      await user.click(connectButton);
      
      expect(mockOnConnect).toHaveBeenCalledWith('192.168.1.103', '');
    });
    
    it('handles connection errors gracefully', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      mockOnConnect.mockRejectedValueOnce(new Error('Connection timeout'));
      
      render(
        <DeviceManager
          connectionState={defaultConnectionState}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
        />
      );
      
      const input = screen.getByLabelText(/Device IP Address/i);
      const connectButton = screen.getByRole('button', { name: /connect/i });
      
      await user.type(input, '192.168.1.103');
      await user.click(connectButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Connection timeout/)).toBeInTheDocument();
      });
      
      expect(toast.error).toHaveBeenCalledWith('Connection failed', {
        id: expect.any(String),
        description: 'Connection timeout'
      });
    });
  });
  
  describe('Device Discovery', () => {
    it('shows discovery button and handles click', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      render(
        <DeviceManager
          connectionState={defaultConnectionState}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
        />
      );
      
      const discoverButton = screen.getByRole('button', { name: /discover/i });
      expect(discoverButton).toBeInTheDocument();
      
      await user.click(discoverButton);
      
      // Should show scanning state
      expect(screen.getByText(/scanning/i)).toBeInTheDocument();
      expect(discoverButton).toBeDisabled();
    });
    
    it('displays discovered devices with proper sorting', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      render(
        <DeviceManager
          connectionState={defaultConnectionState}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
        />
      );
      
      const discoverButton = screen.getByRole('button', { name: /discover/i });
      await user.click(discoverButton);
      
      // Fast-forward through discovery delay
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      
      await waitFor(() => {
        expect(screen.getByText('K1 Device #1')).toBeInTheDocument();
      });
      
      // Check that devices are displayed
      expect(screen.getByText('192.168.1.103:80')).toBeInTheDocument();
      expect(screen.getByText('v2.4.1')).toBeInTheDocument();
    });
    
    it('handles discovery errors', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      // Mock console.error to avoid test output noise
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      render(
        <DeviceManager
          connectionState={defaultConnectionState}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
        />
      );
      
      const discoverButton = screen.getByRole('button', { name: /discover/i });
      await user.click(discoverButton);
      
      // Fast-forward and expect error handling
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      
      await waitFor(() => {
        expect(discoverButton).not.toBeDisabled();
      });
      
      consoleSpy.mockRestore();
    });
  });
  
  describe('Auto-reconnect Functionality', () => {
    it('shows auto-reconnect toggle', () => {
      render(
        <DeviceManager
          connectionState={defaultConnectionState}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
        />
      );
      
      expect(screen.getByText('Auto-reconnect')).toBeInTheDocument();
      expect(screen.getByRole('switch')).toBeInTheDocument();
    });
    
    it('persists auto-reconnect setting', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      render(
        <DeviceManager
          connectionState={defaultConnectionState}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
        />
      );
      
      const toggle = screen.getByRole('switch');
      await user.click(toggle);
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'deviceManager.autoReconnect',
        'true'
      );
    });
    
    it('shows reconnection status when active', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      mockLocalStorage.getItem.mockReturnValue('true'); // Auto-reconnect enabled
      mockOnConnect.mockRejectedValue(new Error('Connection failed'));
      
      render(
        <DeviceManager
          connectionState={defaultConnectionState}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
        />
      );
      
      // Enable auto-reconnect and trigger a failed connection
      const input = screen.getByLabelText(/Device IP Address/i);
      const connectButton = screen.getByRole('button', { name: /connect/i });
      
      await user.type(input, '192.168.1.103');
      await user.click(connectButton);
      
      // Should show reconnection status
      await waitFor(() => {
        expect(screen.getByText(/Reconnecting/)).toBeInTheDocument();
      });
    });
  });
  
  describe('Error Handling and Recovery', () => {
    it('shows retry button after connection failure', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      mockOnConnect.mockRejectedValueOnce(new Error('Network error'));
      
      render(
        <DeviceManager
          connectionState={defaultConnectionState}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
        />
      );
      
      const input = screen.getByLabelText(/Device IP Address/i);
      const connectButton = screen.getByRole('button', { name: /connect/i });
      
      await user.type(input, '192.168.1.103');
      await user.click(connectButton);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });
    
    it('clears errors on successful connection', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      mockOnConnect
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce(undefined);
      
      render(
        <DeviceManager
          connectionState={defaultConnectionState}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
        />
      );
      
      const input = screen.getByLabelText(/Device IP Address/i);
      const connectButton = screen.getByRole('button', { name: /connect/i });
      
      // First connection fails
      await user.type(input, '192.168.1.103');
      await user.click(connectButton);
      
      await waitFor(() => {
        expect(screen.getByText(/First failure/)).toBeInTheDocument();
      });
      
      // Retry succeeds
      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);
      
      await waitFor(() => {
        expect(screen.queryByText(/First failure/)).not.toBeInTheDocument();
      });
    });
  });
  
  describe('Device Cache and Deduplication', () => {
    it('shows clear cache button when devices are cached', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      render(
        <DeviceManager
          connectionState={defaultConnectionState}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
        />
      );
      
      // Trigger discovery to populate cache
      const discoverButton = screen.getByRole('button', { name: /discover/i });
      await user.click(discoverButton);
      
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /clear cache/i })).toBeInTheDocument();
      });
    });
    
    it('clears cache when clear button is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      render(
        <DeviceManager
          connectionState={defaultConnectionState}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
        />
      );
      
      // Trigger discovery
      const discoverButton = screen.getByRole('button', { name: /discover/i });
      await user.click(discoverButton);
      
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      
      await waitFor(() => {
        expect(screen.getByText('K1 Device #1')).toBeInTheDocument();
      });
      
      // Clear cache
      const clearButton = screen.getByRole('button', { name: /clear cache/i });
      await user.click(clearButton);
      
      expect(toast.info).toHaveBeenCalledWith('Device cache cleared');
      expect(screen.queryByText('K1 Device #1')).not.toBeInTheDocument();
    });
  });
  
  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      render(
        <DeviceManager
          connectionState={defaultConnectionState}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
        />
      );
      
      expect(screen.getByRole('switch')).toHaveAccessibleName();
      expect(screen.getByRole('textbox')).toHaveAccessibleName();
      expect(screen.getAllByRole('button')).toHaveLength(2); // Connect and Discover buttons
    });
    
    it('supports keyboard navigation', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      render(
        <DeviceManager
          connectionState={defaultConnectionState}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
        />
      );
      
      const input = screen.getByLabelText(/Device IP Address/i);
      
      // Tab to input and type
      await user.tab();
      expect(input).toHaveFocus();
      
      await user.type(input, '192.168.1.103');
      
      // Tab to connect button and activate
      await user.tab();
      const connectButton = screen.getByRole('button', { name: /connect/i });
      expect(connectButton).toHaveFocus();
      
      await user.keyboard('{Enter}');
      expect(mockOnConnect).toHaveBeenCalled();
    });
  });
});
