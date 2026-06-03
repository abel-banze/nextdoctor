"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Brain,
  Loader2,
  AlertTriangle,
  AlertCircle,
  Info,
  Zap,
  Search,
  Eye,
  BarChart3,
  Code,
  ExternalLink,
  RefreshCw,
  Sparkles,
} from "lucide-react"

interface AIInsight {
  category: "performance" | "seo" | "ux" | "traffic" | "code_quality"
  severity: "info" | "warning" | "critical"
  title: string
  description: string
  suggestion: string
  codeUrl: string | null
  metric: string | null
}

interface AnalyticsInsightsResult {
  summary: string
  insights: AIInsight[]
}

interface WebVitals {
  avgLcp: number
  avgCls: number
  avgFid: number
  avgInp: number
  avgTtfb: number
  avgFcp: number
  avgDomInteractive: number
}

interface AnalyticsData {
  overview: {
    totalVisitors: number
    totalSessions: number
    totalPageviews: number
    bounceRate: number
    avgSessionDuration: number
  }
  webVitals: WebVitals
  dailyStats: { date: string; visitors: number; sessions: number; pageviews: number }[]
  topPages: { url: string; count: number }[]
  trafficSources: { source: string; count: number }[]
  browsers: { browser: string; count: number }[]
  os: { os: string; count: number }[]
  devices: { device: string; count: number }[]
  countries: { country: string; count: number }[]
}

const CATEGORY_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string; color: string }> = {
  performance: { icon: Zap, label: "Performance", color: "text-amber-500" },
  seo: { icon: Search, label: "SEO", color: "text-blue-500" },
  ux: { icon: Eye, label: "UX", color: "text-violet-500" },
  traffic: { icon: BarChart3, label: "Traffic", color: "text-emerald-500" },
  code_quality: { icon: Code, label: "Code Quality", color: "text-rose-500" },
}

const SEVERITY_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; border: string; bg: string; badge: string }> = {
  critical: {
    icon: AlertTriangle,
    border: "border-red-500/30",
    bg: "bg-red-500/5",
    badge: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  },
  warning: {
    icon: AlertCircle,
    border: "border-amber-500/30",
    bg: "bg-amber-500/5",
    badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  info: {
    icon: Info,
    border: "border-blue-500/30",
    bg: "bg-blue-500/5",
    badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
}

interface Props {
  projectId: string
  analytics: AnalyticsData | null
}

export function AnalyticsAiInsights({ projectId, analytics }: Props) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalyticsInsightsResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cacheKey = `ai-insights-${projectId}`

  useEffect(() => {
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        const parsed = JSON.parse(cached) as AnalyticsInsightsResult
        setResult(parsed)
      }
    } catch {}
  }, [cacheKey])

  const runAnalysis = useCallback(async () => {
    if (!analytics) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/ai/analytics-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, analytics }),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Analysis failed: ${res.status} — ${text}`)
      }

      const data = (await res.json()) as AnalyticsInsightsResult

      if (data.insights?.length > 0) {
        try {
          localStorage.setItem(cacheKey, JSON.stringify(data))
        } catch {}
      }

      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed")
    } finally {
      setLoading(false)
    }
  }, [projectId, analytics, cacheKey])

  const insightsBySeverity = useMemo(() => {
    if (!result?.insights) return { critical: [], warning: [], info: [] }
    const groups: Record<string, AIInsight[]> = { critical: [], warning: [], info: [] }
    for (const insight of result.insights) {
      if (groups[insight.severity]) {
        groups[insight.severity].push(insight)
      } else {
        groups.info.push(insight)
      }
    }
    return groups
  }, [result])

  if (!analytics) return null

  return (
    <Card size="sm" className="overflow-hidden">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="size-4 text-purple-500" />
            <CardTitle>AI Insights</CardTitle>
          </div>
          {result && (
            <Button
              variant="outline"
              size="sm"
              onClick={runAnalysis}
              disabled={loading}
              className="gap-1.5"
            >
              {loading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Re-analyze
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {!result && !loading && !error && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-purple-500/10">
              <Sparkles className="size-5 text-purple-500" />
            </div>
            <div>
              <p className="text-sm font-medium">Get AI-powered insights</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Analyze bounce rates, traffic trends, SEO, and more. The AI can access your GitHub code and live site.
              </p>
            </div>
            <Button onClick={runAnalysis} disabled={loading} className="gap-1.5">
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Brain className="size-4" />
              )}
              Analyze with AI
            </Button>
          </div>
        )}

        {loading && !result && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Loader2 className="size-6 animate-spin text-purple-500" />
            <div>
              <p className="text-sm font-medium">Analyzing your data...</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                The AI is reviewing analytics, fetching your site, and checking GitHub code
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {result && !loading && (
          <div className="space-y-4">
            {result.summary && (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {result.summary}
              </p>
            )}

            {result.insights.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <Info className="size-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No specific insights found for this period.</p>
              </div>
            )}

            {/* Critical insights */}
            {insightsBySeverity.critical.length > 0 && (
              <InsightGroup insights={insightsBySeverity.critical} />
            )}

            {/* Warning insights */}
            {insightsBySeverity.warning.length > 0 && (
              <InsightGroup insights={insightsBySeverity.warning} />
            )}

            {/* Info insights */}
            {insightsBySeverity.info.length > 0 && (
              <InsightGroup insights={insightsBySeverity.info} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function InsightGroup({ insights }: { insights: AIInsight[] }) {
  return (
    <div className="space-y-2">
      {insights.map((insight, i) => {
        const sev = SEVERITY_CONFIG[insight.severity]
        const cat = CATEGORY_CONFIG[insight.category]
        const SevIcon = sev.icon
        const CatIcon = cat.icon

        return (
          <div
            key={i}
            className={`rounded-lg border ${sev.border} ${sev.bg} p-3 transition-colors hover:bg-foreground/[0.02]`}
          >
            <div className="flex items-start gap-3">
              <SevIcon className={`mt-0.5 size-4 shrink-0 ${
                insight.severity === "critical" ? "text-red-500" :
                insight.severity === "warning" ? "text-amber-500" :
                "text-blue-500"
              }`} />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug">{insight.title}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      {cat && (
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${sev.badge}`}>
                          {CatIcon && <CatIcon className="size-3" />}
                          {cat.label}
                        </span>
                      )}
                      {insight.metric && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-muted bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {insight.metric}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {insight.description}
                </p>
                <div className="rounded-md border border-border/50 bg-background/50 p-2.5">
                  <p className="text-xs font-medium text-foreground/80">
                    <span className="text-muted-foreground">Suggestion: </span>
                    {insight.suggestion}
                  </p>
                </div>
                {insight.codeUrl && (
                  <a
                    href={insight.codeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400"
                  >
                    <ExternalLink className="size-3" />
                    View code on GitHub
                  </a>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
