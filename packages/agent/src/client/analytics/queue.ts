import type { AnalyticsEventPayload } from './types.js';

const QUEUE_KEY = 'nd_analytics_queue';

export function queueEvent(event: AnalyticsEventPayload) {
  try {
    const existing = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    existing.push(event);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(existing.slice(-50)));
  } catch { /* localStorage may be full or unavailable */ }
}

export async function replayQueue(endpoint: string, projectToken: string) {
  try {
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    if (!queue.length) return;
    localStorage.removeItem(QUEUE_KEY);
    const url = `${endpoint.replace(/\/$/, '')}/ingest`;
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${projectToken}`,
      },
      body: JSON.stringify({ analytics: queue }),
      keepalive: true,
    });
  } catch { /* silent */ }
}
