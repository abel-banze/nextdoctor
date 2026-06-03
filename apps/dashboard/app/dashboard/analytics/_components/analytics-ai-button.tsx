"use client"

import { Brain, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
  onOpen: () => void
  hasAnalyses?: boolean
}

export function AnalyticsAiButton({ onOpen, hasAnalyses = false }: Props) {
  return (
    <Button
      onClick={onOpen}
      variant="outline"
      size="sm"
      className="gap-1.5"
      title={hasAnalyses ? "View analyses history" : "Generate AI-powered insights"}
    >
      {hasAnalyses ? (
        <>
          <Brain className="size-4 text-purple-500" />
          <span className="hidden sm:inline">Insights</span>
        </>
      ) : (
        <>
          <Sparkles className="size-4" />
          <span className="hidden sm:inline">Analyze</span>
        </>
      )}
    </Button>
  )
}
