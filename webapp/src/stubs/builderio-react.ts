// Lightweight stub for '@builder.io/react' to allow builds without the real package.
// Provides a minimal Builder with a no-op registerComponent.
export const Builder = {
  registerComponent: (...args: any[]) => {
    try {
      const name = args?.[1]?.name ?? args?.[0]?.name ?? 'unknown';
      if (typeof console !== 'undefined' && import.meta?.env?.DEV) {
        console.warn(`[stub] Builder.registerComponent invoked for: ${name}`);
      }
    } catch {
      // ignore
    }
  },
};

export default Builder;
