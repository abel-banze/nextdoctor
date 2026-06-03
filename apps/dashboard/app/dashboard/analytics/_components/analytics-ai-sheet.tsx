"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Brain, AlertTriangle, AlertCircle, Info, ChevronRight } from "lucide-react"
import { AnalyticsInsightsEmpty } from "./analytics-insights-empty"

interface AIInsight {
  category: "performance" | "seo" | "ux" | "traffic" | "code_quality"
  severity: "info" | "warning" | "critical"
  title: string
  description: string
  suggestion: string
  codeUrl: string | null
  metric: string | null
}

interface AnalysisRecord {
  id: string
  timestamp: number
  summary: string
  insights: AIInsight[]
  criticalCount: number
  warningCount: number
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  analytics: any
}

const STORAGE_KEY = (projectId: string) => `ai-analyses-${projectId}`

const SEVERITY_ICONS = {
  critical: { icon: AlertTriangle, color: "text-red-500" },
  warning: { icon: AlertCircle, color: "text-amber-500" },
  info: { icon: Info, color: "text-blue-500" },
}

export function AnalyticsAiSheet({ open, onOpenChange, projectId, analytics }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([])
  const [error, setError] = useState<string | null>(null)

  // Load analyses from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY(projectId))
      if (stored) {
        const parsed = JSON.parse(stored) as AnalysisRecord[]
        setAnalyses(parsed.sort((a, b) => b.timestamp - a.timestamp))
      }
    } catch {}
  }, [projectId, open])

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

      const data = await res.json()

      // Create new analysis record
      const newAnalysis: AnalysisRecord = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        summary: data.summary,
        insights: data.insights || [],
        criticalCount: (data.insights || []).filter((i: AIInsight) => i.severity === "critical").length,
        warningCount: (data.insights || []).filter((i: AIInsight) => i.severity === "warning").length,
      }

      // Update localStorage
      const updated = [newAnalysis, ...analyses]
      localStorage.setItem(STORAGE_KEY(projectId), JSON.stringify(updated))
      setAnalyses(updated)

      // Navigate to details page
      router.push(`/dashboard/analytics/insights/${newAnalysis.id}?projectId=${projectId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed")
    } finally {
      setLoading(false)
    }
  }, [projectId, analytics, analyses, router])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Brain className="size-5 text-purple-500" />
            AI Insights
          </SheetTitle>
          <SheetDescription>
            Generate and view AI-powered analysis of your analytics data
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex-1 flex flex-col">
          {error && (
            <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/5 p-2.5 text-xs text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {analyses.length === 0 ? (
            <AnalyticsInsightsEmpty onAnalyze={runAnalysis} isLoading={loading} />
          ) : (
            <>
              <div className="mb-4">
                <Button
                  onClick={runAnalysis}
                  disabled={loading}
                  className="w-full gap-1.5"
                  size="sm"
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Brain className="size-4" />
                  )}
                  Generate New Analysis
                </Button>
              </div>

              <div>
                <p className="mb-3 text-xs font-medium text-muted-foreground">Recent Analyses</p>
                <ScrollArea className="h-[calc(100vh-250px)]">
                  <div className="space-y-2 pr-4">
                    {analyses.map((analysis) => (
                      <button
                        key={analysis.id}
                        onClick={() => {
                          onOpenChange(false)
                          router.push(
                            `/dashboard/analytics/insights/${analysis.id}?projectId=${projectId}`
                          )
                        }}
                        className="w-full rounded-lg border border-border/50 bg-card p-3 text-left transition-colors hover:bg-accent/50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-muted-foreground">
                              {new Date(analysis.timestamp).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                            <p className="mt-1.5 line-clamp-2 text-xs text-foreground">
                              {analysis.summary}
                            </p>
                            <div className="mt-2 flex items-center gap-1.5">
                              {analysis.criticalCount > 0 && (
                                <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 bg-red-500/10 text-[10px] font-medium text-red-600 dark:text-red-400">
                                  <AlertTriangle className="size-3" />
                                  {analysis.criticalCount}
                                </span>
                              )}
                              {analysis.warningCount > 0 && (
                                <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 bg-amber-500/10 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                  <AlertCircle className="size-3" />
                                  {analysis.warningCount}
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
