'use client';

import { useEffect } from 'react';
// @ts-expect-error next/web-vitals will be resolved by the consuming Next.js application
import { useReportWebVitals } from 'next/web-vitals';

interface NextDoctorProviderProps {
  children: React.ReactNode;
  projectToken: string;
  endpoint?: string;
  enableReactScan?: boolean;
}

export function NextDoctorProvider({
  children,
  projectToken,
  endpoint = 'https://ingest.nextdoctor.dev',
  enableReactScan = true
}: NextDoctorProviderProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useReportWebVitals((metric: any) => {
    // Collect Core Web Vitals: FCP, LCP, CLS, FID, INP, TTFB
    const body = JSON.stringify({
      metricName: metric.name,
      value: metric.value,
      rating: metric.rating, // 'good' | 'needs-improvement' | 'poor'
      id: metric.id, // unique id of the metric
      navigationType: metric.navigationType, // 'navigate' | 'reload' | 'back-forward' | etc.
    });

    // Send the Web Vitals to the NextDoctor ingest using Navigator.sendBeacon or fetch
    const url = `${endpoint}/vitals`;
    
    // Attempt standard fetch first (non-blocking)
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      } else {
        fetch(url, {
          body,
          method: 'POST',
          headers: {
             'Content-Type': 'application/json',
             'Authorization': `Bearer ${projectToken}` 
          },
          keepalive: true 
        });
      }
    } catch (e) {
      console.error('[NextDoctor] failed to report web vitals', e);
    }
  });

  useEffect(() => {
    let reactScan: { scan: (opts: any) => void; getReport: () => any } | null = null;

    // 1. Initialize react-scan in development (optional — consumer may not have it)
    if (typeof window !== 'undefined' && enableReactScan && process.env.NODE_ENV === 'development') {
      import('react-scan').then((mod) => {
        reactScan = mod;
        mod.scan({ enabled: true, log: true });
      }).catch(() => { /* react-scan not installed — skip */ });
    }

    // 2. Reporting loop for react-scan
    const reportInterval = setInterval(() => {
      if (typeof window !== 'undefined' && enableReactScan && process.env.NODE_ENV === 'development' && reactScan) {
        const reportMap = reactScan.getReport();
        if (!reportMap || !(typeof reportMap.forEach === 'function')) return;

        const reportArray: any[] = [];
        (reportMap as any).forEach((data: any, name: string) => {
          // Only report components with more than 2 re-renders or significant time
          if (data.count > 2 || data.time > 10) {
            reportArray.push({
              component: name,
              count: data.count,
              time: data.time,
              displayName: data.displayName,
            });
          }
        });

        if (reportArray.length > 0) {
          const sessionId = sessionStorage.getItem('nextdoctor_session_id');
          fetch(`${endpoint}/react-scan`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${projectToken}`,
              'X-NextDoctor-Session-ID': sessionId || 'unknown'
            },
            body: JSON.stringify({
              timestamp: Date.now(),
              url: window.location.href,
              reports: reportArray
            }),
            keepalive: true
          }).catch(() => { /* Silent failure for telemetry */ });
        }
      }
    }, 30000); // Every 30 seconds

    // 3. Generate or retrieve session ID for end-to-end tracing
    if (typeof window !== 'undefined') {
      let sessionId = sessionStorage.getItem('nextdoctor_session_id');
      if (!sessionId) {
        sessionId = crypto.randomUUID();
        sessionStorage.setItem('nextdoctor_session_id', sessionId);
      }
      
      // Monkey patch fetch to inject session ID for backend tracing correlation
      const originalFetch = window.fetch;
      window.fetch = async function(...args) {
        const [resource, config] = args;
        
        // Convert config to object if undefined
        const newConfig = { ...config };
        newConfig.headers = new Headers(newConfig.headers || {});
        
        if (!newConfig.headers.has('X-NextDoctor-Session-ID')) {
           newConfig.headers.append('X-NextDoctor-Session-ID', sessionId as string);
        }
        
        return originalFetch(resource, newConfig);
      };
    }

    return () => {
      clearInterval(reportInterval);
    };
  }, [enableReactScan, endpoint, projectToken]);

  return <>{children}</>;
}
