import '@testing-library/jest-dom';

type GlobalWithIdle = typeof globalThis & {
  requestIdleCallback?: (callback: IdleRequestCallback) => number;
  cancelIdleCallback?: (handle: number) => void;
};

// Provide a noop requestIdleCallback for components that expect it in tests.
const globalIdle = globalThis as GlobalWithIdle;

if (!globalIdle.requestIdleCallback) {
  globalIdle.requestIdleCallback = (cb: IdleRequestCallback) =>
    setTimeout(
      () =>
        cb({
          didTimeout: false,
          timeRemaining: () => 0,
        }),
      16,
    );
  globalIdle.cancelIdleCallback = (id: number) => clearTimeout(id);
}
