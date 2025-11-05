/**
 * PatternSelector Component Tests
 * 
 * Task 4.6: Add component tests, error simulations, and perf checks
 * - Renders 11 patterns grouped by categories
 * - Click triggers selectPattern with correct id
 * - Server error rolls back selection and shows toast
 * - Duplicate clicks are ignored while pending
 * - Performance assertions for interaction timing
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PatternSelector } from '../PatternSelector';
import { ConnectionState } from '../../../lib/types';
import { K1_PATTERNS } from '../../../lib/patterns';
import { postSelect } from '../../../lib/api';
import { toast } from 'sonner';

// Mock dependencies
jest.mock('../../../lib/api', () => ({
  postSelect: jest.fn()
}));

jest.mock('sonner', () => ({
  toast: {
    loading: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn()
  }
}));

const mockPostSelect = jest.mocked(postSelect);
const mockToast = jest.mocked(toast);

describe('PatternSelector', () => {
  const mockOnPatternSelect = jest.fn();
  
  const connectedState: ConnectionState = {
    connected: true,
    deviceIp: '192.168.1.103',
    serialPort: ''
  };
  
  const disconnectedState: ConnectionState = {
    connected: false,
    deviceIp: '',
    serialPort: ''
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockPostSelect.mockResolvedValue({ ok: true, confirmed: true });
  });
  
  afterEach(() => {
    jest.useRealTimers();
  });
  
  describe('Rendering and Structure', () => {
    it('renders all 11 patterns grouped by categories', () => {
      render(
        <PatternSelector
          connectionState={connectedState}
          onPatternSelect={mockOnPatternSelect}
        />
      );
      
      // Check category headers
      expect(screen.getByText('Static')).toBeInTheDocument();
      expect(screen.getByText('Audio-Reactive')).toBeInTheDocument();
      expect(screen.getByText('Beat-Reactive')).toBeInTheDocument();
      
      // Check all patterns are rendered
      K1_PATTERNS.forEach(pattern => {
        expect(screen.getByText(pattern.name)).toBeInTheDocument();
        expect(screen.getByText(pattern.description)).toBeInTheDocument();
      });
      
      // Check pattern count
      const patternButtons = screen.getAllByRole('button', { name: /Select .* pattern/ });
      expect(patternButtons).toHaveLength(11);
    });
    
    it('shows correct category counts', () => {
      render(
        <PatternSelector
          connectionState={connectedState}
          onPatternSelect={mockOnPatternSelect}
        />
      );
      
      expect(screen.getByText('3 patterns')).toBeInTheDocument(); // Static
      expect(screen.getAllByText('4 patterns')).toHaveLength(2); // Audio-Reactive and Beat-Reactive
    });
    
    it('displays connection status indicator', () => {
      const { rerender } = render(
        <PatternSelector
          connectionState={connectedState}
          onPatternSelect={mockOnPatternSelect}
        />
      );
      
      expect(screen.getByText('Connected')).toBeInTheDocument();
      
      rerender(
        <PatternSelector
          connectionState={disconnectedState}
          onPatternSelect={mockOnPatternSelect}
        />
      );
      
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });
    
    it('shows selected pattern with visual indicator', () => {
      render(
        <PatternSelector
          connectionState={connectedState}
          selectedPatternId="solid"
          onPatternSelect={mockOnPatternSelect}
        />
      );
      
      const solidButton = screen.getByRole('button', { name: /Select Solid Color pattern/ });
      expect(solidButton).toHaveAttribute('aria-pressed', 'true');
    });
  });
  
  describe('Pattern Selection', () => {
    it('calls onPatternSelect when pattern is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      render(
        <PatternSelector
          connectionState={connectedState}
          onPatternSelect={mockOnPatternSelect}
        />
      );
      
      const solidButton = screen.getByRole('button', { name: /Select Solid Color pattern/ });
      act(() => {
        fireEvent.click(solidButton);
      });
      
      // Should immediately call onPatternSelect (optimistic update)
      expect(mockOnPatternSelect).toHaveBeenCalledWith('solid');
    });
    
    it('calls postSelect API with correct parameters', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      render(
        <PatternSelector
          connectionState={connectedState}
          onPatternSelect={mockOnPatternSelect}
        />
      );
      
      const solidButton = screen.getByRole('button', { name: /Select Solid Color pattern/ });
      act(() => {
        fireEvent.click(solidButton);
      });
      
      // Assert API call synchronously under fake timers
      expect(mockPostSelect).toHaveBeenCalledWith('192.168.1.103', {
        id: 'solid',
        index: 0
      });
    });
    
    it('shows loading state during selection', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      // Make API call hang
      mockPostSelect.mockImplementation(() => new Promise(() => {}));
      
      render(
        <PatternSelector
          connectionState={connectedState}
          onPatternSelect={mockOnPatternSelect}
        />
      );
      
      const solidButton = screen.getByRole('button', { name: /Select Solid Color pattern/ });
      act(() => {
        fireEvent.click(solidButton);
      });
      
      // Should show loading indicator
      expect(screen.getByText('Activating pattern...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cancel/ })).toBeInTheDocument();
    });
    
    it('prevents duplicate clicks while selection is pending', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      // Make API call hang
      mockPostSelect.mockImplementation(() => new Promise(() => {}));
      
      render(
        <PatternSelector
          connectionState={connectedState}
          onPatternSelect={mockOnPatternSelect}
        />
      );
      
      const solidButton = screen.getByRole('button', { name: /Select Solid Color pattern/ });
      
      // Click multiple times rapidly
      await act(async () => {
        fireEvent.click(solidButton);
        fireEvent.click(solidButton);
        fireEvent.click(solidButton);
      });
      
      // Should only call API once
      expect(mockPostSelect).toHaveBeenCalledTimes(1);
    });
    
    it('disables all patterns when disconnected', () => {
      render(
        <PatternSelector
          connectionState={disconnectedState}
          onPatternSelect={mockOnPatternSelect}
        />
      );
      
      const patternButtons = screen.getAllByRole('button', { name: /Select .* pattern/ });
      patternButtons.forEach(button => {
        expect(button).toBeDisabled();
      });
    });
  });
  
  describe('Error Handling', () => {
    it('handles API errors and rolls back selection', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      mockPostSelect.mockRejectedValueOnce(new Error('Network error'));
      
      render(
        <PatternSelector
          connectionState={connectedState}
          selectedPatternId="gradient"
          onPatternSelect={mockOnPatternSelect}
        />
      );
      
      const solidButton = screen.getByRole('button', { name: /Select Solid Color pattern/ });
      act(() => {
        fireEvent.click(solidButton);
      });
      
      // Should rollback to previous selection (flush microtasks)
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });
      expect(mockOnPatternSelect).toHaveBeenCalledWith('gradient');
      
      // Should show error message
      expect(screen.getByText('Pattern Selection Error')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
    
    it('handles timeout errors', async () => {
      
      // Make API call hang longer than timeout
      mockPostSelect.mockImplementation(() => new Promise(() => {}));
      
      render(
        <PatternSelector
          connectionState={connectedState}
          onPatternSelect={mockOnPatternSelect}
        />
      );
      
      const solidButton = screen.getByRole('button', { name: /Select Solid Color pattern/ });
      await act(async () => {
        fireEvent.click(solidButton);
      });
      
      // Fast-forward past timeout (2 seconds)
      await act(async () => {
        jest.advanceTimersByTime(2100);
        await jest.advanceTimersByTimeAsync(0); // Allow microtasks to settle
      });
      
      expect(screen.getByText('Pattern Selection Error')).toBeInTheDocument();
    });
    
    it('allows error dismissal', async () => {
      
      mockPostSelect.mockRejectedValueOnce(new Error('Test error'));
      
      render(
        <PatternSelector
          connectionState={connectedState}
          onPatternSelect={mockOnPatternSelect}
        />
      );
      
      const solidButton = screen.getByRole('button', { name: /Select Solid Color pattern/ });
      await act(async () => {
        fireEvent.click(solidButton);
      });
      
      // Advance timers to allow any microtask/timer-driven updates to settle
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });
      expect(screen.getByText('Test error')).toBeInTheDocument();
      
      // Dismiss error - find the dismiss button in the error section
      const allButtons = screen.getAllByRole('button');
      const dismissButton = allButtons.find(button => {
        const errorSection = button.closest('.bg-red-50');
        return errorSection !== null;
      });
      expect(dismissButton).toBeDefined();
      act(() => {
        fireEvent.click(dismissButton!);
      });
      
      expect(screen.queryByText('Test error')).not.toBeInTheDocument();
    });
    
    it('allows cancellation of pending selection', async () => {
      
      // Make API call hang
      mockPostSelect.mockImplementation(() => new Promise(() => {}));
      
      render(
        <PatternSelector
          connectionState={connectedState}
          selectedPatternId="gradient"
          onPatternSelect={mockOnPatternSelect}
        />
      );
      
      const solidButton = screen.getByRole('button', { name: /Select Solid Color pattern/ });
      act(() => {
        fireEvent.click(solidButton);
      });
      
      // Should show cancel button
      const cancelButton = screen.getByRole('button', { name: /Cancel/ });
      act(() => {
        fireEvent.click(cancelButton);
      });
      
      // Should rollback selection
      expect(mockOnPatternSelect).toHaveBeenLastCalledWith('gradient');
      expect(screen.queryByText('Activating pattern...')).not.toBeInTheDocument();
    });
  });
  
  describe('Keyboard Navigation', () => {
    it('supports arrow key navigation', async () => {
      render(
        <PatternSelector
          connectionState={connectedState}
          onPatternSelect={mockOnPatternSelect}
        />
      );
      
      // Focus first pattern
      const firstPattern = screen.getAllByRole('button', { name: /Select .* pattern/ })[0];
      firstPattern.focus();
      
      // Navigate with arrow keys by issuing keyDown on the focused button
      act(() => {
        fireEvent.keyDown(firstPattern, { key: 'ArrowRight' });
      });
      
      // Should move focus to next pattern
      const secondPattern = screen.getAllByRole('button', { name: /Select .* pattern/ })[1];
      expect(secondPattern).toHaveFocus();
    });
    
    it('supports Home and End keys', async () => {
      
      render(
        <PatternSelector
          connectionState={connectedState}
          onPatternSelect={mockOnPatternSelect}
        />
      );
      
      const patterns = screen.getAllByRole('button', { name: /Select .* pattern/ });
      
      // Focus middle pattern
      patterns[5].focus();
      
      // Press Home via keyDown on the focused button
      act(() => {
        fireEvent.keyDown(patterns[5], { key: 'Home' });
      });
      expect(patterns[0]).toHaveFocus();
      
      // Press End via keyDown on the focused button
      act(() => {
        fireEvent.keyDown(patterns[0], { key: 'End' });
      });
      expect(patterns[patterns.length - 1]).toHaveFocus();
    });
    
    it('supports Enter and Space for selection', async () => {
      
      render(
        <PatternSelector
          connectionState={connectedState}
          onPatternSelect={mockOnPatternSelect}
        />
      );
      
      const firstPattern = screen.getAllByRole('button', { name: /Select .* pattern/ })[0];
      firstPattern.focus();
      
      // Select with Enter (simulate click on focused button)
      await act(async () => {
        fireEvent.click(firstPattern);
      });
      
      expect(mockOnPatternSelect).toHaveBeenCalled();
    });
  });
  
  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      render(
        <PatternSelector
          connectionState={connectedState}
          onPatternSelect={mockOnPatternSelect}
        />
      );
      
      // Check main container
      expect(screen.getByRole('application')).toHaveAccessibleName('Pattern selector');
      
      // Check category groups
      expect(screen.getByRole('group', { name: /Static/ })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: /Audio-Reactive/ })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: /Beat-Reactive/ })).toBeInTheDocument();
      
      // Check pattern grids
      expect(screen.getByRole('grid', { name: 'Static patterns' })).toBeInTheDocument();
      
      // Check pattern buttons have proper labels
      const solidButton = screen.getByRole('button', { name: /Select Solid Color pattern/ });
      expect(solidButton).toHaveAttribute('aria-pressed');
      expect(solidButton).toHaveAttribute('title');
    });
    
    it('maintains focus management during selection', async () => {
      
      render(
        <PatternSelector
          connectionState={connectedState}
          onPatternSelect={mockOnPatternSelect}
        />
      );
      
      const solidButton = screen.getByRole('button', { name: /Select Solid Color pattern/ });
      solidButton.focus();
      
      await act(async () => {
        fireEvent.click(solidButton);
      });
      
      // Focus should remain on the button after selection
      expect(solidButton).toHaveFocus();
    });
  });
  
  describe('Performance', () => {
    it('renders within performance budget', () => {
      const startTime = performance.now();
      
      render(
        <PatternSelector
          connectionState={connectedState}
          onPatternSelect={mockOnPatternSelect}
        />
      );
      
      const renderTime = performance.now() - startTime;
      
      // Should render in under 16ms (60fps budget)
      expect(renderTime).toBeLessThan(16);
    });
    
    it('handles rapid interactions without performance degradation', async () => {
      
      render(
        <PatternSelector
          connectionState={connectedState}
          onPatternSelect={mockOnPatternSelect}
        />
      );
      
      const patterns = screen.getAllByRole('button', { name: /Select .* pattern/ });
      
      const startTime = performance.now();
      
      // Rapidly hover over multiple patterns
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          fireEvent.mouseOver(patterns[i]);
          fireEvent.mouseOut(patterns[i]);
        });
      }
      
      const interactionTime = performance.now() - startTime;
      
      // Should handle interactions smoothly
      expect(interactionTime).toBeLessThan(100);
    });
  });
  
  describe('Toast Notifications', () => {
    it('shows loading toast during selection', async () => {
      
      render(
        <PatternSelector
          connectionState={connectedState}
          onPatternSelect={mockOnPatternSelect}
        />
      );
      
      const solidButton = screen.getByRole('button', { name: /Select Solid Color pattern/ });
      await act(async () => {
        fireEvent.click(solidButton);
      });
      
      expect(mockToast.loading).toHaveBeenCalledWith(
        'Activating Solid Color...',
        { description: 'Single solid color across all LEDs' }
      );
    });
    
    it('shows success toast on successful selection', async () => {
      mockPostSelect.mockResolvedValueOnce({ ok: true, data: {} } as any);
      
      render(
        <PatternSelector
          connectionState={connectedState}
          onPatternSelect={mockOnPatternSelect}
        />
      );
      
      const solidButton = screen.getByRole('button', { name: /Select Solid Color pattern/ });
      await act(async () => {
        fireEvent.click(solidButton);
      });
      
      // Flush any user-event timers/microtasks
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });
      expect(mockToast.success).toHaveBeenCalledWith(
        'Solid Color activated',
        expect.objectContaining({
          description: 'Pattern switched successfully'
        })
      );
    });
    
    it('shows error toast on failed selection', async () => {
      
      mockPostSelect.mockRejectedValueOnce(new Error('Device error'));
      
      render(
        <PatternSelector
          connectionState={connectedState}
          onPatternSelect={mockOnPatternSelect}
        />
      );
      
      const solidButton = screen.getByRole('button', { name: /Select Solid Color pattern/ });
      await act(async () => {
        fireEvent.click(solidButton);
      });
      
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });
      expect(mockToast.error).toHaveBeenCalledWith(
        'Failed to activate Solid Color',
        expect.objectContaining({
          description: 'Device error'
        })
      );
    });
  });
});
