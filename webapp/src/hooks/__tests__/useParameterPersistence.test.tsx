import { renderHook, act } from '@testing-library/react';
import { useParameterPersistence } from '../useParameterPersistence';

describe('useParameterPersistence', () => {
  const patternId = 'test-pattern';
  const storageKey = `k1:params:${patternId}`;

  beforeEach(() => {
    localStorage.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('debounced auto-save after parameter changes', () => {
    const { result } = renderHook(() =>
      useParameterPersistence({ patternId, autoSave: true, saveDelay: 300 })
    );

    // Perform multiple rapid updates
    act(() => {
      result.current.updateParam('brightness', 10);
      result.current.updateParam('brightness', 20);
      result.current.updateParam('brightness', 30);
    });

    // Before debounce window elapses, nothing saved
    expect(localStorage.getItem(storageKey)).toBeNull();

    // Advance less than delay
    act(() => {
      jest.advanceTimersByTime(299);
    });
    expect(localStorage.getItem(storageKey)).toBeNull();

    // Advance 1ms to cross debounce threshold
    act(() => {
      jest.advanceTimersByTime(1);
    });

    const saved = localStorage.getItem(storageKey);
    expect(saved).not.toBeNull();
    const parsed = JSON.parse(String(saved));
    expect(parsed.brightness).toBe(30);
  });

  test('cancels pending debounce and saves on unmount when there are unsaved changes', () => {
    const { result, unmount } = renderHook(() =>
      useParameterPersistence({ patternId, autoSave: true, saveDelay: 300 })
    );

    // Change a param to create unsaved changes
    act(() => {
      result.current.updateParam('speed', 77);
    });

    // Unmount before debounce delay completes
    act(() => {
      unmount();
    });

    // On unmount, hook saves immediately if unsaved changes exist
    const saved = localStorage.getItem(storageKey);
    expect(saved).not.toBeNull();
    const parsed = JSON.parse(String(saved));
    expect(parsed.speed).toBe(77);
  });

  test('resetToDefaults writes defaults when autoSave enabled', () => {
    const { result } = renderHook(() =>
      useParameterPersistence({ patternId, autoSave: true, saveDelay: 300 })
    );

    // Update a couple params
    act(() => {
      result.current.updateParam('warmth', 5);
      result.current.updateParam('softness', 9);
    });

    // Ensure something got saved after debounce
    act(() => {
      jest.advanceTimersByTime(300);
    });

    // Now reset to defaults; with autoSave this saves immediately
    act(() => {
      result.current.resetToDefaults();
    });

    const saved = localStorage.getItem(storageKey);
    expect(saved).not.toBeNull();
    const parsed = JSON.parse(String(saved));
    // Defaults are 75 brightness, 50 speed, 80 saturation, 50 warmth, 30 softness, 10 background
    expect(parsed).toMatchObject({ brightness: 75, speed: 50, saturation: 80, warmth: 50, softness: 30, background: 10 });
  });
});

