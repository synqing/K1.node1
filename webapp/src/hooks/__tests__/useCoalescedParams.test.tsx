import { renderHook, act } from '@testing-library/react';
import { useCoalescedParams } from '../useCoalescedParams';
import type { UIParams } from '../../lib/parameters';

describe('useCoalescedParams', () => {
  let originalRAF: typeof global.requestAnimationFrame | undefined;
  let originalCancelRAF: typeof global.cancelAnimationFrame | undefined;

  beforeEach(() => {
    jest.useFakeTimers();
    // Make RAF execute immediately for deterministic tests
    originalRAF = global.requestAnimationFrame;
    originalCancelRAF = global.cancelAnimationFrame;
    global.requestAnimationFrame = (cb: FrameRequestCallback) => {
      cb(0);
      return 1 as any;
    };
    global.cancelAnimationFrame = () => {};
  });

  afterEach(() => {
    jest.useRealTimers();
    if (originalRAF) global.requestAnimationFrame = originalRAF;
    if (originalCancelRAF) global.cancelAnimationFrame = originalCancelRAF;
  });

  test('coalesces rapid changes within delay into a single send', () => {
    const onSend = jest.fn(async (_params: Partial<UIParams>) => {});

    const { result } = renderHook(() =>
      useCoalescedParams({ onSend, delay: 80, leadingEdge: true, maxWait: 500 })
    );

    act(() => {
      result.current.scheduleSend('speed', 10);
      // Rapid change before leading-edge timeout executes
      result.current.scheduleSend('speed', 20);
    });

    // Leading 0ms timeout should not run yet; zero advance first
    act(() => {
      jest.advanceTimersByTime(0);
    });
    expect(onSend).not.toHaveBeenCalled();

    // Before 80ms window, nothing is sent
    act(() => {
      jest.advanceTimersByTime(79);
    });
    expect(onSend).not.toHaveBeenCalled();

    // At 80ms window, one trailing send fires
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(onSend).toHaveBeenCalledTimes(1);
    const sent = onSend.mock.calls[0][0];
    expect(sent.speed).toBe(20);
  });

  test('sends immediately on isolated single change (leading edge)', () => {
    const onSend = jest.fn(async (_params: Partial<UIParams>) => {});
    const { result } = renderHook(() =>
      useCoalescedParams({ onSend, delay: 80, leadingEdge: true, maxWait: 500 })
    );

    act(() => {
      result.current.scheduleSend('brightness', 42);
    });

    // Advance zero to trigger leading timeout
    act(() => {
      jest.advanceTimersByTime(0);
    });
    expect(onSend).toHaveBeenCalledTimes(1);
    const sent = onSend.mock.calls[0][0];
    expect(sent.brightness).toBe(42);
  });

  test('forces send when maxWait elapses despite continuous changes', () => {
    const onSend = jest.fn(async (_params: Partial<UIParams>) => {});
    const { result } = renderHook(() =>
      useCoalescedParams({ onSend, delay: 80, leadingEdge: true, maxWait: 200 })
    );

    // Establish an initial send so lastSendTime is set
    act(() => {
      result.current.scheduleSend('saturation', 10);
      jest.advanceTimersByTime(0);
    });
    expect(onSend).toHaveBeenCalledTimes(1);

    // Now keep changing within the 80ms delay repeatedly
    act(() => {
      result.current.scheduleSend('saturation', 20);
      jest.advanceTimersByTime(50);
      result.current.scheduleSend('saturation', 30);
      jest.advanceTimersByTime(50);
      result.current.scheduleSend('saturation', 40);
    });

    // We have advanced 100ms total since last send; advance another 101ms to exceed maxWait
    act(() => {
      jest.advanceTimersByTime(101);
    });

    // MaxWait exceeded -> immediate trailing send (actualDelay = 0)
    expect(onSend).toHaveBeenCalledTimes(2);
    const sent2 = onSend.mock.calls[1][0];
    expect(sent2.saturation).toBe(40);
  });
});

