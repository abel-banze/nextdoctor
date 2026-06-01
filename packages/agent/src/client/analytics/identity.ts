import { classifyVisitSource } from './events.js';

const VISITOR_ID_KEY = 'nextdoctor_visitor_id';
const FIRST_VISIT_KEY = 'nd_first_visit';

export function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `nd_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

export function getOrCreateVisitorId() {
  if (typeof window === 'undefined') return 'unknown';
  try {
    const existing = window.localStorage.getItem(VISITOR_ID_KEY);
    if (existing) return existing;
    const newId = generateId();
    window.localStorage.setItem(VISITOR_ID_KEY, newId);
    return newId;
  } catch {
    return generateId();
  }
}

export function getOrCreateFirstVisit(
  referrer: string | null,
  utmSource: string | null,
  utmMedium: string | null,
  searchParams: URLSearchParams,
): { channel: string; url: string } {
  try {
    const stored = window.localStorage.getItem(FIRST_VISIT_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* noop */ }
  const channel = classifyVisitSource(referrer, utmSource, utmMedium, searchParams);
  const entry = { channel, url: window.location.href };
  try {
    window.localStorage.setItem(FIRST_VISIT_KEY, JSON.stringify(entry));
  } catch { /* noop */ }
  return entry;
}
