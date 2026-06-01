export interface AnalyticsProps {
  projectToken: string;
  endpoint?: string;
  bounceThresholdMs?: number;
  sampleRate?: number;
  children: React.ReactNode;
}

export interface AnalyticsEventPayload {
  type:
    | 'session_start'
    | 'pageview'
    | 'session_end'
    | 'performance'
    | 'conversion'
    | 'feature'
    | 'form_abandonment'
    | 'custom';
  eventName?: string;
  sessionId: string;
  visitorId: string;
  url: string;
  referrer?: string | null;
  title: string;
  browser: string;
  os: string;
  device: string;
  language: string;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  visitSource?: string | null;
  durationMs?: number;
  isBounce?: boolean;
  lcpMs?: number;
  cls?: number;
  fidMs?: number;
  inpMs?: number;
  ttfbMs?: number;
  fcpMs?: number;
  domInteractiveMs?: number;
  scrollDepthPercent?: number;
  clickCount?: number;
  engagementTimeMs?: number;
  metadata?: Record<string, unknown> | null;
  timestamp: number;
}

export interface NextDoctorAnalytics {
  track: (eventName: string, metadata?: Record<string, unknown>) => void;
  identify: (userId: string, traits?: Record<string, unknown>) => void;
}

declare global {
  interface Window {
    __nextdoctor?: NextDoctorAnalytics;
  }
}
