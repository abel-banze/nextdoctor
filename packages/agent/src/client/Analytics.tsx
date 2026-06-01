'use client';

import { useEffect } from 'react';
import type { AnalyticsProps, AnalyticsEventPayload, NextDoctorAnalytics } from './analytics/types.js';
import { getOrCreateSessionId, getSessionStart, hasSessionStarted, markSessionStarted } from './analytics/session.js';
import { getOrCreateVisitorId, getOrCreateFirstVisit } from './analytics/identity.js';
import { isInteractiveElement } from './analytics/browser.js';
import { replayQueue } from './analytics/queue.js';
import { collectNavigationMetrics, createPerformanceObservers } from './analytics/performance.js';
import { buildAnalyticsEvent, sendAnalyticsEvent, classifyVisitSource, persistUtms, resolveUtms } from './analytics/events.js';

const DEFAULT_ENDPOINT = 'https://api-nextdoctor.codebaz.cloud';
const IS_PATCHED_KEY = '__nd_history_patched';
const RAGE_CLICK_THRESHOLD = 3;
const RAGE_CLICK_WINDOW_MS = 1000;

export function Analytics({
  projectToken,
  endpoint = DEFAULT_ENDPOINT,
  bounceThresholdMs = 10000,
  sampleRate = 1,
  children,
}: AnalyticsProps) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (Math.random() > (sampleRate ?? 1)) return;

    const sessionId = getOrCreateSessionId();
    const visitorId = getOrCreateVisitorId();
    const sessionStartTime = getSessionStart();
    const searchParams = new URLSearchParams(window.location.search);

    persistUtms(searchParams);

    if (!hasSessionStarted()) {
      markSessionStarted();
      const entryUrl = window.location.href;
      const resolved = resolveUtms(searchParams);
      const entryChannel = classifyVisitSource(
        document.referrer || null,
        resolved.utmSource ?? null,
        resolved.utmMedium ?? null,
        searchParams,
      );
      const firstVisit = getOrCreateFirstVisit(
        document.referrer || null,
        resolved.utmSource ?? null,
        resolved.utmMedium ?? null,
        searchParams,
      );
      void sendAnalyticsEvent(
        buildAnalyticsEvent('session_start', sessionId, visitorId, searchParams, {
          metadata: { source: 'browser-analytics', entryChannel, entryUrl, firstVisitChannel: firstVisit.channel, firstVisitUrl: firstVisit.url },
        }),
        endpoint,
        projectToken,
      );
    }

    const performanceMetrics: Partial<AnalyticsEventPayload> = {};

    let maxScrollDepth = 0;
    let scrollTicking = false;
    const updateScrollDepth = () => {
      if (scrollTicking) return;
      scrollTicking = true;
      requestAnimationFrame(() => {
        const scrollTop = window.scrollY || window.pageYOffset;
        const documentHeight = Math.max(
          document.documentElement.scrollHeight,
          document.body.scrollHeight,
          document.documentElement.clientHeight,
          document.body.clientHeight,
        );
        const scrollableHeight = documentHeight - window.innerHeight;
        if (scrollableHeight > 0) {
          maxScrollDepth = Math.max(maxScrollDepth, Math.min(100, Math.round((scrollTop / scrollableHeight) * 100)));
        }
        scrollTicking = false;
      });
    };

    let clickCount = 0;
    let lastRageTarget: Element | null = null;
    let rageClicksInWindow = 0;
    let rageClickTimer: ReturnType<typeof setTimeout> | null = null;

    const handleClick = (e: MouseEvent) => {
      clickCount += 1;
      const target = e.target as HTMLElement;

      const trackable = target.closest('[data-track]') || target.closest('[data-analytics-event]');
      if (trackable) {
        const eventName = trackable.getAttribute('data-track') || trackable.getAttribute('data-analytics-event') || 'click';
        void sendAnalyticsEvent(
          buildAnalyticsEvent('feature', sessionId, visitorId, new URLSearchParams(window.location.search), {
            eventName,
            metadata: { element: target.tagName, text: target.textContent?.slice(0, 100) },
          }),
          endpoint,
          projectToken,
        );
      }

      if (lastRageTarget === target || (lastRageTarget && target.closest(lastRageTarget.tagName) === lastRageTarget)) {
        rageClicksInWindow += 1;
      } else {
        rageClicksInWindow = 1;
        lastRageTarget = target;
      }

      if (rageClickTimer) clearTimeout(rageClickTimer);
      rageClickTimer = setTimeout(() => {
        if (rageClicksInWindow >= RAGE_CLICK_THRESHOLD) {
          void sendAnalyticsEvent(
            buildAnalyticsEvent('feature', sessionId, visitorId, new URLSearchParams(window.location.search), {
              eventName: 'rage_click',
              metadata: {
                element: target.tagName,
                text: target.textContent?.slice(0, 100),
                clicks: rageClicksInWindow,
              },
            }),
            endpoint,
            projectToken,
          );
        }
        rageClicksInWindow = 0;
        lastRageTarget = null;
      }, RAGE_CLICK_WINDOW_MS);

      if (!isInteractiveElement(target)) {
        void sendAnalyticsEvent(
          buildAnalyticsEvent('feature', sessionId, visitorId, new URLSearchParams(window.location.search), {
            eventName: 'dead_click',
            metadata: {
              element: target.tagName,
              text: target.textContent?.slice(0, 100),
              className: target.className,
            },
          }),
          endpoint,
          projectToken,
        );
      }
    };

    const interactedForms = new Set<HTMLFormElement>();
    const handleFormInteraction = (e: Event) => {
      const target = e.target as HTMLElement;
      const form = target.closest('form');
      if (form && !interactedForms.has(form)) {
        interactedForms.add(form);
      }
    };

    const checkFormAbandonment = () => {
      if (interactedForms.size === 0) return;
      void sendAnalyticsEvent(
        buildAnalyticsEvent('form_abandonment', sessionId, visitorId, new URLSearchParams(window.location.search), {
          eventName: 'form_abandonment',
          metadata: { formsInteracted: interactedForms.size, route: window.location.pathname },
        }),
        endpoint,
        projectToken,
      );
    };

    const sendPageview = () => {
      const sp = new URLSearchParams(window.location.search);
      persistUtms(sp);
      void sendAnalyticsEvent(
        buildAnalyticsEvent('pageview', sessionId, visitorId, sp, {
          metadata: { route: window.location.pathname },
        }),
        endpoint,
        projectToken,
      );
    };

    const handleNavigation = () => { sendPageview(); };

    const sendPerformanceEvent = () => {
      const navMetrics = collectNavigationMetrics();
      void sendAnalyticsEvent(
        buildAnalyticsEvent('performance', sessionId, visitorId, new URLSearchParams(window.location.search), {
          eventName: 'page_performance',
          metadata: {
            route: window.location.pathname,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            connectionType: (navigator as any).connection?.effectiveType || undefined,
            darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
          },
          scrollDepthPercent: maxScrollDepth,
          clickCount,
          engagementTimeMs: Date.now() - sessionStartTime,
          ...performanceMetrics,
          ...navMetrics,
        }),
        endpoint,
        projectToken,
      );
    };

    let sessionEndSent = false;
    const sendSessionEndOnce = () => {
      if (sessionEndSent) return;
      sessionEndSent = true;
      const durationMs = Date.now() - sessionStartTime;
      void sendAnalyticsEvent(
        buildAnalyticsEvent('session_end', sessionId, visitorId, new URLSearchParams(window.location.search), {
          durationMs,
          isBounce: durationMs < bounceThresholdMs,
          metadata: { route: window.location.pathname },
        }),
        endpoint,
        projectToken,
      );
    };

    if (!(window as any)[IS_PATCHED_KEY]) {
      (window as any)[IS_PATCHED_KEY] = true;
      const originalPushState = window.history.pushState.bind(window.history) as (...args: any[]) => void;
      const originalReplaceState = window.history.replaceState.bind(window.history) as (...args: any[]) => void;

      (window as any).__nd_original_pushState = originalPushState;
      (window as any).__nd_original_replaceState = originalReplaceState;

      window.history.pushState = ((...args: any[]) => {
        originalPushState(...args);
        handleNavigation();
      }) as typeof window.history.pushState;
      window.history.replaceState = ((...args: any[]) => {
        originalReplaceState(...args);
        handleNavigation();
      }) as typeof window.history.replaceState;
    }

    const cleanupPerformanceObservers = createPerformanceObservers(performanceMetrics);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        sendPerformanceEvent();
        sendSessionEndOnce();
        checkFormAbandonment();
      }
    };

    const handlePageHide = () => {
      sendPerformanceEvent();
      sendSessionEndOnce();
      checkFormAbandonment();
    };

    const handleOnline = () => { replayQueue(endpoint, projectToken); };

    window.addEventListener('scroll', updateScrollDepth, { passive: true });
    window.addEventListener('click', handleClick, { capture: true });
    window.addEventListener('focusin', handleFormInteraction, { passive: true });
    window.addEventListener('change', handleFormInteraction, { passive: true });
    window.addEventListener('input', handleFormInteraction, { passive: true });
    window.addEventListener('popstate', handleNavigation);
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('online', handleOnline);

    sendPageview();

    const handleLoad = () => {
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(sendPerformanceEvent, { timeout: 5000 });
      } else {
        setTimeout(sendPerformanceEvent, 3000);
      }
    };
    if (document.readyState === 'complete') {
      handleLoad();
    } else {
      window.addEventListener('load', handleLoad, { once: true });
    }

    if (!window.__nextdoctor) {
      const api: NextDoctorAnalytics = {
        track: (eventName, metadata) => {
          void sendAnalyticsEvent(
            buildAnalyticsEvent('custom', sessionId, visitorId, new URLSearchParams(window.location.search), {
              eventName,
              metadata: metadata ?? null,
            }),
            endpoint,
            projectToken,
          );
        },
        identify: (userId, traits) => {
          void sendAnalyticsEvent(
            buildAnalyticsEvent('feature', sessionId, visitorId, new URLSearchParams(window.location.search), {
              eventName: 'identify',
              metadata: { userId, ...traits } as Record<string, unknown>,
            }),
            endpoint,
            projectToken,
          );
        },
      };
      window.__nextdoctor = api;
    }

    return () => {
      window.removeEventListener('scroll', updateScrollDepth);
      window.removeEventListener('click', handleClick, { capture: true });
      window.removeEventListener('focusin', handleFormInteraction);
      window.removeEventListener('change', handleFormInteraction);
      window.removeEventListener('input', handleFormInteraction);
      window.removeEventListener('popstate', handleNavigation);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('online', handleOnline);
      cleanupPerformanceObservers();
    };
  }, [endpoint, projectToken, bounceThresholdMs, sampleRate]);

  return <>{children}</>;
}
