let politeEl: HTMLElement | null = null;
let assertiveEl: HTMLElement | null = null;

function ensureRegions() {
  if (typeof document === 'undefined') return;
  if (!politeEl) {
    politeEl = document.createElement('div');
    politeEl.setAttribute('role', 'status');
    politeEl.setAttribute('aria-live', 'polite');
    politeEl.className = 'sr-only';
    document.body.appendChild(politeEl);
  }
  if (!assertiveEl) {
    assertiveEl = document.createElement('div');
    assertiveEl.setAttribute('role', 'alert');
    assertiveEl.setAttribute('aria-live', 'assertive');
    assertiveEl.className = 'sr-only';
    document.body.appendChild(assertiveEl);
  }
}

export function announce(message: string, politeness: 'polite' | 'assertive' = 'polite') {
  if (typeof document === 'undefined') return;
  ensureRegions();
  const target = politeness === 'assertive' ? assertiveEl : politeEl;
  if (!target) return;

  // Clear then set to retrigger screen reader announcement
  target.textContent = '';
  // Use a microtask to ensure DOM change is registered
  setTimeout(() => {
    if (target) target.textContent = message;
    // Clean up after a short delay
    setTimeout(() => {
      if (target) target.textContent = '';
    }, 1000);
  }, 0);
}

