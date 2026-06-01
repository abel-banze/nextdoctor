import { generateId } from './identity.js';

const SESSION_ID_KEY = 'nextdoctor_session_id';
const SESSION_START_KEY = 'nextdoctor_session_start';
const SESSION_STARTED_KEY = '__nd_session_started';

export function getOrCreateSessionId() {
  if (typeof window === 'undefined') return 'unknown';
  try {
    let sessionId = window.sessionStorage.getItem(SESSION_ID_KEY);
    if (!sessionId) {
      sessionId = generateId();
      window.sessionStorage.setItem(SESSION_ID_KEY, sessionId);
      window.sessionStorage.setItem(SESSION_START_KEY, String(Date.now()));
    }
    return sessionId;
  } catch {
    return generateId();
  }
}

export function getSessionStart(): number {
  if (typeof window === 'undefined') return Date.now();
  try {
    const value = window.sessionStorage.getItem(SESSION_START_KEY);
    return value ? Number(value) || Date.now() : Date.now();
  } catch {
    return Date.now();
  }
}

export function hasSessionStarted(): boolean {
  try {
    return window.sessionStorage.getItem(SESSION_STARTED_KEY) === '1';
  } catch {
    return false;
  }
}

export function markSessionStarted() {
  try {
    window.sessionStorage.setItem(SESSION_STARTED_KEY, '1');
  } catch { /* noop */ }
}
