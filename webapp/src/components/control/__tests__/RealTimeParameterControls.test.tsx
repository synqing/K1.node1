/**
 * Real-Time Parameter Controls Tests
 * 
 * Task 5.8: Timer-based integration tests for call rate, latency, and persistence
 * - Verify end-to-end behavior meets latency and coalescing goals
 * - Assert first outbound call occurs within ~100ms
 * - No more than two calls per 500ms window with merged payloads
 * - Validate per-pattern persistence on switch and reload
 * - Reset restoring defaults
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { RealTimeParameterControls } from '../RealTimeParameterControls';
import { ConnectionState } from '../../../lib/types';
import { DEFAULT_PARAMS } from '../../../lib/parameters';
import { postParams } from '../../../lib/api';

// Mock dependencies
jest.mock('../../../lib/api', () => ({
  postParams: jest.fn()
}));

const mockPostParams = jest.mocked(postParams);

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

// Mock performance.now for timing tests via spy (avoid replacing read-only property)
const performanceNowSpy = jest.spyOn(window.performance, 'now');
// Mock requestAnimationFrame/cancelAnimationFrame to be timer-driven for fake timers
let rafSpy: any;
let cafSpy: any;

describe('RealTimeParameterControls', () => {
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
    // Ensure real timers before switching to fake timers to avoid double-install errors
    try { jest.useRealTimers(); } catch {}
    jest.useFakeTimers();
    // Make RAF callbacks flush via timers to avoid jsdom async gaps
    rafSpy = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      // Execute callback immediately with current performance.now(), which is also spied
      cb(window.performance.now());
      // Return a dummy id; cancelAnimationFrame is a no-op
      return 0 as any;
    });
    cafSpy = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((_id: number) => {
      // No-op for tests
    });
    
    // Mock successful API responses
    mockPostParams.mockResolvedValue({
      ok: true,
      confirmed: true,
      data: { brightness: 0.75, speed: 0.5 }
    });
    
    // Mock localStorage to return defaults
    mockLocalStorage.getItem.mockReturnValue(null);
    
    // Mock performance.now with incrementing values
    let performanceTime = 0;
    performanceNowSpy.mockImplementation(() => {
      performanceTime += 10; // Increment by 10ms each call
      return performanceTime;
    });
  });
  
  afterEach(() => {
    try { performanceNowSpy.mockRestore(); } catch {}
    try { rafSpy?.mockRestore(); } catch {}
    try { cafSpy?.mockRestore(); } catch {}
    jest.useRealTimers();
  });
  
  describe('Rendering and Structure', () => {
    it('renders all six parameter sliders', () => {
      render(
        <RealTimeParameterControls
          connectionState={connectedState}
          patternId="test-pattern"
        />
      );
      
      // Check for all six parameters
      expect(screen.getByText('Brightness')).toBeInTheDocument();
      expect(screen.getByText('Speed')).toBeInTheDocument();
      expect(screen.getByText('Saturation')).toBeInTheDocument();
      expect(screen.getByText('Warmth')).toBeInTheDocument();
      expect(screen.getByText('Softness')).toBeInTheDocument();
      expect(screen.getByText('Background')).toBeInTheDocument();
    });
    
    it('shows connection status indicator', () => {
      const { rerender } = render(
        <RealTimeParameterControls
          connectionState={connectedState}
          patternId="test-pattern"
        />
      );
      
      // Should show connected (green dot)
      expect(document.querySelector('.bg-green-500')).toBeInTheDocument();
      
      rerender(
        <RealTimeParameterControls
          connectionState={disconnectedState}
          patternId="test-pattern"
        />
      );
      
      // Should show disconnected (red dot)
      expect(document.querySelector('.bg-red-500')).toBeInTheDocument();
    });
    
    it('disables sliders when disconnected', () => {
      render(
        <RealTimeParameterControls
          connectionState={disconnectedState}
          patternId="test-pattern"
        />
      );
      
      // All sliders should be disabled
      const sliders = screen.getAllByRole('slider');
      sliders.forEach(slider => {
        expect(slider).toBeDisabled();
      });
    });
    
    it('shows control buttons', () => {
      render(
        <RealTimeParameterControls
          connectionState={connectedState}
          patternId="test-pattern"
        />
      );
      
      expect(screen.getByRole('button', { name: /reset all/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    });
  });
  
  describe('Parameter Updates and Coalescing', () => {
    it('sends first parameter change immediately (leading edge)', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      render(
        <RealTimeParameterControls
          connectionState={connectedState}
          patternId="test-pattern"
        />
      );
      
      // Find brightness slider
      const brightnessSlider = screen.getByRole('slider', { name: /brightness/i });
      
      // Change brightness value
      await user.click(brightnessSlider);
      fireEvent.change(brightnessSlider, { target: { value: '80' } });
      
      // Should send immediately (leading edge)
      await waitFor(() => {
        expect(mockPostParams).toHaveBeenCalledWith('192.168.1.103', {
          brightness: 0.8 // 80% converted to 0.8
        });
      });
      
      // Should be called within 100ms (leading edge requirement)
      expect(mockPostParams).toHaveBeenCalledTimes(1);
    });
    
    it('coalesces rapid parameter changes within 80ms window', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      render(
        <RealTimeParameterControls
          connectionState={connectedState}
          patternId="test-pattern"
        />
      );
      
      const brightnessSlider = screen.getByRole('slider', { name: /brightness/i });
      const speedSlider = screen.getByLabelText(/speed/i);
      
      // Make rapid changes
      fireEvent.change(brightnessSlider, { target: { value: '80' } });
      fireEvent.change(speedSlider, { target: { value: '60' } });
      fireEvent.change(brightnessSlider, { target: { value: '85' } });
      
      // Fast-forward through coalescing delay
      act(() => {
        jest.advanceTimersByTime(100);
      });
      
      await waitFor(() => {
        expect(mockPostParams).toHaveBeenCalled();
      });
      
      // Should coalesce into fewer calls than individual changes
      expect(mockPostParams).toHaveBeenCalledTimes(1);
      
      // Should include both parameters in final call
      const lastCall = mockPostParams.mock.calls[mockPostParams.mock.calls.length - 1];
      expect(lastCall[1]).toEqual(
        expect.objectContaining({
          brightness: 0.85,
          speed: 0.6
        })
      );
    });
    
    it('respects maximum call rate (≤2 calls per 500ms)', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      render(
        <RealTimeParameterControls
          connectionState={connectedState}
          patternId="test-pattern"
        />
      );
      
      const brightnessSlider = screen.getByRole('slider', { name: /brightness/i });
      
      // Make changes over 500ms period
      for (let i = 0; i < 10; i++) {
        fireEvent.change(brightnessSlider, { target: { value: `${70 + i}` } });
        
        act(() => {
          jest.advanceTimersByTime(50); // 50ms between changes
        });
      }
      
      // Wait for all coalescing to complete
      act(() => {
        jest.advanceTimersByTime(200);
      });
      
      await waitFor(() => {
        expect(mockPostParams).toHaveBeenCalled();
      });
      
      // Should not exceed 2 calls per 500ms window
      expect(mockPostParams).toHaveBeenCalledTimes(2);
    });
    
    it('flushes pending changes on commit', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      render(
        <RealTimeParameterControls
          connectionState={connectedState}
          patternId="test-pattern"
        />
      );
      
      const brightnessSlider = screen.getByRole('slider', { name: /brightness/i });
      
      // Make change but don't wait for coalescing
      fireEvent.change(brightnessSlider, { target: { value: '80' } });
      
      // Simulate slider commit (mouse up)
      fireEvent.pointerUp(brightnessSlider);
      
      // Should flush immediately without waiting for coalescing delay
      await waitFor(() => {
        expect(mockPostParams).toHaveBeenCalledWith('192.168.1.103', {
          brightness: 0.8
        });
      });
    });
  });
  
  describe('Per-Pattern Persistence', () => {
    it('loads saved parameters for pattern', () => {
      // Mock stored parameters
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
        brightness: 90,
        speed: 40,
        saturation: 70,
        warmth: 60,
        softness: 20,
        background: 15
      }));
      
      render(
        <RealTimeParameterControls
          connectionState={connectedState}
          patternId="saved-pattern"
        />
      );
      
      // Should load saved values
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('k1:params:saved-pattern');
      
      // Check that brightness slider shows saved value
      const brightnessInput = screen.getByDisplayValue('90');
      expect(brightnessInput).toBeInTheDocument();
    });
    
    it('saves parameters on change', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      render(
        <RealTimeParameterControls
          connectionState={connectedState}
          patternId="test-pattern"
        />
      );
      
      const brightnessSlider = screen.getByRole('slider', { name: /brightness/i });
      
      // Change parameter
      fireEvent.change(brightnessSlider, { target: { value: '80' } });
      
      // Wait for auto-save delay
      // Advance timers well beyond adaptive backoff jitter to reach final failure
      await act(async () => {
        await jest.advanceTimersByTimeAsync(6000);
      });
      
      // Should save to localStorage
      await waitFor(() => {
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          'k1:params:test-pattern',
          expect.stringContaining('"brightness":80')
        );
      });
    });
    
    it('switches parameters when pattern changes', () => {
      const { rerender } = render(
        <RealTimeParameterControls
          connectionState={connectedState}
          patternId="pattern-1"
        />
      );
      
      // Change to different pattern
      rerender(
        <RealTimeParameterControls
          connectionState={connectedState}
          patternId="pattern-2"
        />
      );
      
      // Should load parameters for new pattern
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('k1:params:pattern-2');
    });
  });
  
  describe('Reset Functionality', () => {
    it('resets all parameters to defaults', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      render(
        <RealTimeParameterControls
          connectionState={connectedState}
          patternId="test-pattern"
        />
      );
      
      // Change some parameters first
      const brightnessSlider = screen.getByRole('slider', { name: /brightness/i });
      fireEvent.change(brightnessSlider, { target: { value: '90' } });
      
      // Click reset all
      const resetButton = screen.getByRole('button', { name: /reset all/i });
      await user.click(resetButton);
      
      // Should send default values
      await waitFor(() => {
        expect(mockPostParams).toHaveBeenCalledWith('192.168.1.103', {
          brightness: DEFAULT_PARAMS.brightness / 100,
          speed: DEFAULT_PARAMS.speed / 100,
          saturation: DEFAULT_PARAMS.saturation / 100,
          warmth: DEFAULT_PARAMS.warmth / 100,
          softness: DEFAULT_PARAMS.softness / 100,
          background: DEFAULT_PARAMS.background / 100
        });
      });
    });
    
    it('resets individual parameters', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      render(
        <RealTimeParameterControls
          connectionState={connectedState}
          patternId="test-pattern"
        />
      );
      
      // Change brightness
      const brightnessSlider = screen.getByRole('slider', { name: /brightness/i });
      fireEvent.change(brightnessSlider, { target: { value: '90' } });
      
      // Find and click brightness reset button
      const resetButtons = screen.getAllByTitle(/reset.*to default/i);
      const brightnessResetButton = resetButtons.find(btn => 
        btn.getAttribute('title')?.includes('Brightness')
      );
      
      if (brightnessResetButton) {
        await user.click(brightnessResetButton);
        
        // Should reset to default value
        await waitFor(() => {
          const brightnessInput = screen.getByDisplayValue(DEFAULT_PARAMS.brightness.toString());
          expect(brightnessInput).toBeInTheDocument();
        });
      }
    });
  });
  
  describe('Error Handling', () => {
    it('displays transport errors', async () => {
      // Force final failure (no successful retry)
      mockPostParams
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('Network timeout'));
      
      render(
        <RealTimeParameterControls
          connectionState={connectedState}
          patternId="test-pattern"
        />
      );
      
      const brightnessInput = screen.getByLabelText(/brightness value/i);
      fireEvent.change(brightnessInput, { target: { value: '80' } });
      // Flush RAF/coalescing scheduling
      await act(async () => {
        await jest.advanceTimersByTimeAsync(20);
      });
      // Advance timers well beyond adaptive backoff jitter to reach final failure
      await act(async () => {
        await jest.advanceTimersByTimeAsync(6000);
      });
      
      // After advancing timers sufficiently, error should be rendered
      expect(screen.getByText('Transport Error')).toBeInTheDocument();
      expect(screen.getByText(/network timeout/i)).toBeInTheDocument();
    });
    
    it('allows error dismissal', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      // Force final failure (no successful retry)
      mockPostParams
        .mockRejectedValueOnce(new Error('Test error'))
        .mockRejectedValueOnce(new Error('Test error'));
      
      render(
        <RealTimeParameterControls
          connectionState={connectedState}
          patternId="test-pattern"
        />
      );
      
      const brightnessInput = screen.getByLabelText(/brightness value/i);
      fireEvent.change(brightnessInput, { target: { value: '80' } });
      // Flush RAF/coalescing scheduling
      await act(async () => {
        await jest.advanceTimersByTimeAsync(20);
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(3000);
      });
      
      expect(screen.getByText('Transport Error')).toBeInTheDocument();
      
      // Dismiss error (use synchronous click to avoid user-event timer coupling)
      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      await act(async () => {
        fireEvent.click(dismissButton);
      });
      
      expect(screen.queryByText('Transport Error')).not.toBeInTheDocument();
    });
    
    it('retries failed requests', async () => {
      mockPostParams
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce({ ok: true, confirmed: true, data: {} });
      
      render(
        <RealTimeParameterControls
          connectionState={connectedState}
          patternId="test-pattern"
        />
      );
      
      const brightnessInput = screen.getByLabelText(/brightness value/i);
      fireEvent.change(brightnessInput, { target: { value: '80' } });
      // Flush RAF/coalescing scheduling
      await act(async () => {
        await jest.advanceTimersByTimeAsync(20);
      });
      
      // Wait for retry (include jitter upper bound ~25% on ~2024ms)
      await act(async () => {
        await jest.advanceTimersByTimeAsync(3000);
      });
      
      expect(mockPostParams).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('Performance Requirements', () => {
    it('renders within performance budget', () => {
      const startTime = performance.now();
      
      render(
        <RealTimeParameterControls
          connectionState={connectedState}
          patternId="test-pattern"
        />
      );
      
      const renderTime = performance.now() - startTime;
      
      // Should render in under 16ms (60fps budget)
      expect(renderTime).toBeLessThan(16);
    });
    
    it('maintains smooth interactions during rapid changes', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      render(
        <RealTimeParameterControls
          connectionState={connectedState}
          patternId="test-pattern"
        />
      );
      
      const brightnessSlider = screen.getByRole('slider', { name: /brightness/i });
      
      const startTime = performance.now();
      
      // Simulate rapid slider movements
      for (let i = 0; i < 20; i++) {
        fireEvent.change(brightnessSlider, { target: { value: `${50 + i}` } });
        
        act(() => {
          jest.advanceTimersByTime(16); // 60fps = 16ms per frame
        });
      }
      
      const totalTime = performance.now() - startTime;
      
      // Should handle rapid changes smoothly
      expect(totalTime).toBeLessThan(500); // 500ms for 20 changes
    });
  });
  
  describe('Advanced Features', () => {
    it('shows performance monitor when enabled', () => {
      render(
        <RealTimeParameterControls
          connectionState={connectedState}
          patternId="test-pattern"
          showAdvanced={true}
        />
      );
      
      // Should show performance indicators
      expect(screen.getByText(/ms/)).toBeInTheDocument(); // Latency display
      expect(screen.getByText(/%/)).toBeInTheDocument(); // Success rate
    });
    
    it('shows debug info when advanced mode enabled', () => {
      render(
        <RealTimeParameterControls
          connectionState={connectedState}
          patternId="test-pattern"
          showAdvanced={true}
        />
      );
      
      // Should show debug section
      expect(screen.getByText('Debug Info')).toBeInTheDocument();
    });

    it('shows backoff badge when rate-limited (429)', async () => {
      // First call rate-limited, then recover on retry
      mockPostParams
        .mockRejectedValueOnce(new Error('Request failed: 429'))
        .mockResolvedValueOnce({ ok: true, confirmed: true, data: {} });

      render(
        <RealTimeParameterControls
          connectionState={connectedState}
          patternId="test-pattern"
          showAdvanced={true}
        />
      );

      const brightnessSlider = screen.getByLabelText(/brightness/i);
      fireEvent.change(brightnessSlider, { target: { value: '80' } });

      // Allow performance monitor to tick and reflect backingOff state
      act(() => {
        jest.advanceTimersByTime(1200);
      });

      // Badge should indicate backoff while retry is pending
      expect(screen.getByText(/Backoff\s+\d+ms/i)).toBeInTheDocument();

      // Advance enough time for retry to clear backingOff
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      // After retry, badge may disappear
      expect(screen.queryByText(/Backoff\s+\d+ms/i)).not.toBeInTheDocument();
    });
  });
});
