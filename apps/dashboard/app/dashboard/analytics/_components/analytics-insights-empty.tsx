"use client"

import { Brain, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
  onAnalyze: () => void
  isLoading?: boolean
}

export function AnalyticsInsightsEmpty({ onAnalyze, isLoading = false }: Props) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-purple-500/10 to-blue-500/10">
        <Sparkles className="size-6 text-purple-500" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold">No analyses yet</p>
        <p className="text-xs text-muted-foreground">
          Generate your first AI-powered analysis to discover insights about bounce rates,
          traffic trends, SEO, and code quality.
        </p>
      </div>
      <Button
        onClick={onAnalyze}
        disabled={isLoading}
        size="sm"
        className="gap-1.5"
      >
        <Brain className="size-4" />
        Generate First Analysis
      </Button>
    </div>
  )
}
