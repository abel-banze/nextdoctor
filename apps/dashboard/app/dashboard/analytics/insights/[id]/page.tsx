"use client"

import { useEffect, useState } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { ArrowLeft, Copy, Check, Code } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { InsightDetailsView } from "../_components/insight-details-view"

const STORAGE_KEY = (projectId: string) => `ai-analyses-${projectId}`

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
}

export default function InsightDetailsPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const id = params.id as string
  const projectId = searchParams.get("projectId")

  const [analysis, setAnalysis] = useState<AnalysisRecord | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) return

    try {
      const stored = localStorage.getItem(STORAGE_KEY(projectId))
      if (stored) {
        const analyses = JSON.parse(stored) as AnalysisRecord[]
        const found = analyses.find((a) => a.id === id)
        setAnalysis(found || null)
      }
    } catch {}
    setLoading(false)
  }, [id, projectId])

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Loading analysis...</p>
        </div>
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <div className="text-center">
          <p className="text-sm font-medium">Analysis not found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            The analysis you're looking for doesn't exist or was removed.
          </p>
        </div>
        <Button onClick={() => router.back()} variant="outline" size="sm">
          <ArrowLeft className="mr-1.5 size-4" />
          Go Back
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button
          onClick={() => router.back()}
          variant="ghost"
          size="sm"
          className="mb-4 gap-1.5"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>

        <div>
          <h1 className="text-2xl font-bold">Analysis Details</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Generated {new Date(analysis.timestamp).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="leading-relaxed text-muted-foreground">{analysis.summary}</p>
        </CardContent>
      </Card>

      {/* Insights */}
      {analysis.insights.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No insights found for this period.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {analysis.insights.map((insight, idx) => (
            <InsightDetailsView key={idx} insight={insight} />
          ))}
        </div>
      )}
    </div>
  )
}
