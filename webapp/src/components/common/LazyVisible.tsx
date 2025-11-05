import React from 'react';

type LazyVisibleProps = {
  children: React.ReactNode;
  placeholder?: React.ReactNode;
  rootMargin?: string;
  once?: boolean;
};

export function LazyVisible({ children, placeholder, rootMargin = '100px', once = true }: LazyVisibleProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    if (isVisible && once) return;
    const el = ref.current;
    if (!el) return;

    if ('IntersectionObserver' in window) {
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setIsVisible(true);
              if (once) obs.disconnect();
            } else if (!once) {
              setIsVisible(false);
            }
          });
        },
        { root: null, rootMargin, threshold: 0.1 }
      );
      obs.observe(el);
      return () => obs.disconnect();
    } else {
      // Fallback: render immediately
      setIsVisible(true);
    }
  }, [isVisible, once, rootMargin]);

  return <div ref={ref}>{isVisible ? children : placeholder ?? null}</div>;
}

