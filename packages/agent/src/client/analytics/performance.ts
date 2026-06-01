import type { AnalyticsEventPayload } from './types.js';

export function collectNavigationMetrics() {
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  const paintEntries = performance.getEntriesByType('paint');
  const fcpEntry = paintEntries.find((entry) => entry.name === 'first-contentful-paint');

  return {
    ttfbMs: nav ? Math.round(nav.responseStart - nav.startTime) : undefined,
    fcpMs: fcpEntry ? Math.round(fcpEntry.startTime) : undefined,
    domInteractiveMs: nav ? Math.round(nav.domInteractive) : undefined,
  };
}

export function createPerformanceObservers(metrics: Partial<AnalyticsEventPayload>) {
  if (typeof PerformanceObserver === 'undefined') {
    return () => undefined;
  }

  const lcpObserver = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const lastEntry = entries[entries.length - 1] as PerformanceEntry | undefined;
    if (lastEntry) {
      metrics.lcpMs = Math.round(lastEntry.startTime);
    }
  });

  const clsObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as Array<PerformanceEntry & { hadRecentInput?: boolean; value?: number }>) {
      if (!entry.hadRecentInput && typeof entry.value === 'number') {
        metrics.cls = (metrics.cls ?? 0) + entry.value;
      }
    }
  });

  const fidObserver = new PerformanceObserver((list) => {
    const entry = list.getEntries()[0] as PerformanceEventTiming | undefined;
    if (entry) {
      metrics.fidMs = Math.round(entry.processingStart - entry.startTime);
    }
  });

  const inpObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as PerformanceEventTiming[]) {
      const duration = entry.duration;
      if (!metrics.inpMs || duration > metrics.inpMs) {
        metrics.inpMs = Math.round(duration);
      }
    }
  });

  lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
  clsObserver.observe({ type: 'layout-shift', buffered: true });
  fidObserver.observe({ type: 'first-input', buffered: true });
  try {
    inpObserver.observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
  } catch { /* INP not supported in all browsers */ }

  return () => {
    lcpObserver.disconnect();
    clsObserver.disconnect();
    fidObserver.disconnect();
    inpObserver.disconnect();
  };
}
