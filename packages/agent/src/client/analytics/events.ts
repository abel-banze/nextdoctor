import type { AnalyticsEventPayload } from './types.js';
import { getBrowserInfo } from './browser.js';
import { queueEvent } from './queue.js';

const UTM_STORAGE_KEY = 'nd_utm';

function getCurrentPageContext() {
  const url = window.location.href;
  const referrer = document.referrer || null;
  const title = document.title || '';
  const language = navigator.language || 'unknown';

  return { url, referrer, title, language };
}

export function persistUtms(searchParams: URLSearchParams) {
  const source = searchParams.get('utm_source');
  if (!source) return;
  try {
    window.sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify({
      utmSource: source,
      utmMedium: searchParams.get('utm_medium'),
      utmCampaign: searchParams.get('utm_campaign'),
      utmTerm: searchParams.get('utm_term'),
      utmContent: searchParams.get('utm_content'),
    }));
  } catch { /* noop */ }
}

export function resolveUtms(searchParams: URLSearchParams) {
  const fromUrl = searchParams.get('utm_source');
  if (fromUrl) {
    return {
      utmSource: fromUrl,
      utmMedium: searchParams.get('utm_medium'),
      utmCampaign: searchParams.get('utm_campaign'),
      utmTerm: searchParams.get('utm_term'),
      utmContent: searchParams.get('utm_content'),
    };
  }
  try {
    const stored = window.sessionStorage.getItem(UTM_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* noop */ }
  return {};
}

function extractMarketingParams(searchParams: URLSearchParams): Record<string, string> {
  const knownParams = ['gclid', 'fbclid', 'msclkid', 'twclid', 'yclid', 'igshid', 'li_fat_id', 'dclid', 'gbraid', 'wbraid'];
  const result: Record<string, string> = {};
  for (const param of knownParams) {
    const value = searchParams.get(param);
    if (value) result[param] = value;
  }
  return result;
}

export function classifyVisitSource(
  referrer: string | null,
  utmSource: string | null,
  utmMedium: string | null,
  searchParams: URLSearchParams,
): string {
  if (searchParams.has('gclid') || utmMedium === 'cpc' || utmMedium === 'ppc' || utmMedium === 'paidsearch') {
    return 'paid';
  }

  if (searchParams.has('fbclid') || utmMedium === 'social') {
    return 'social';
  }

  if (utmMedium === 'email') {
    return 'email';
  }

  if (utmMedium === 'display' || utmMedium === 'banner' || utmMedium === 'cpm') {
    return 'display';
  }

  if (utmSource) {
    return 'utm';
  }

  if (!referrer) {
    return 'direct';
  }

  try {
    const refHost = new URL(referrer).hostname;
    const searchEngines = ['google.', 'bing.', 'yahoo.', 'baidu.', 'duckduckgo.', 'yandex.', 'ask.'];
    if (searchEngines.some(se => refHost.includes(se))) {
      return 'organic';
    }

    const socialDomains = [
      'facebook.com', 'twitter.com', 'x.com', 'linkedin.com', 'instagram.com',
      'pinterest.com', 'reddit.com', 'tumblr.com', 'whatsapp.com', 'telegram.org',
    ];
    if (socialDomains.some(sd => refHost.includes(sd))) {
      return 'social';
    }

    return 'referral';
  } catch {
    return 'unknown';
  }
}

export function buildAnalyticsEvent(
  eventType: AnalyticsEventPayload['type'],
  sessionId: string,
  visitorId: string,
  searchParams: URLSearchParams,
  overrides?: Partial<AnalyticsEventPayload>,
): AnalyticsEventPayload {
  const { url, referrer, title, language } = getCurrentPageContext();
  const utms = resolveUtms(searchParams);
  const { browser, os, device } = getBrowserInfo();
  const marketingParams = extractMarketingParams(searchParams);
  const visitSource = classifyVisitSource(referrer, utms.utmSource, utms.utmMedium, searchParams);

  persistUtms(searchParams);

  const clickIds = Object.keys(marketingParams).length > 0 ? { clickIds: marketingParams } : undefined;
  const mergedMetadata = clickIds || overrides?.metadata
    ? { ...clickIds, ...overrides?.metadata }
    : null;

  return {
    type: eventType,
    sessionId,
    visitorId,
    url,
    referrer,
    title,
    browser,
    os,
    device,
    language,
    utmSource: utms.utmSource ?? null,
    utmMedium: utms.utmMedium ?? null,
    utmCampaign: utms.utmCampaign ?? null,
    utmTerm: utms.utmTerm ?? null,
    utmContent: utms.utmContent ?? null,
    visitSource,
    timestamp: Date.now(),
    ...overrides,
    metadata: mergedMetadata,
  };
}

export async function sendAnalyticsEvent(
  event: AnalyticsEventPayload,
  endpoint: string,
  projectToken: string,
): Promise<{ ok: boolean }> {
  const url = `${endpoint.replace(/\/$/, '')}/ingest`;
  const body = JSON.stringify({ analytics: [event] });

  try {
    if (event.type === 'session_end' || event.type === 'performance') {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
      return { ok: true };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${projectToken}`,
      },
      body,
      keepalive: true,
    });
    return { ok: res.ok };
  } catch {
    queueEvent(event);
    return { ok: false };
  }
}
