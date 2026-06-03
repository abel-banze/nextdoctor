"use client"

import { useState } from "react"
import {
  AlertTriangle,
  AlertCircle,
  Info,
  Zap,
  Search,
  Eye,
  BarChart3,
  Code,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface AIInsight {
  category: "performance" | "seo" | "ux" | "traffic" | "code_quality"
  severity: "info" | "warning" | "critical"
  title: string
  description: string
  suggestion: string
  codeUrl: string | null
  metric: string | null
}

const CATEGORY_CONFIG: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; label: string; color: string }
> = {
  performance: { icon: Zap, label: "Performance", color: "text-amber-500" },
  seo: { icon: Search, label: "SEO", color: "text-blue-500" },
  ux: { icon: Eye, label: "UX", color: "text-violet-500" },
  traffic: { icon: BarChart3, label: "Traffic", color: "text-emerald-500" },
  code_quality: { icon: Code, label: "Code Quality", color: "text-rose-500" },
}

const SEVERITY_CONFIG: Record<
  string,
  {
    icon: React.ComponentType<{ className?: string }>
    border: string
    bg: string
    badge: string
  }
> = {
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

// Generate code snippets based on insight category
function generateCodeSnippet(insight: AIInsight): string | null {
  // For bounce rate / UX improvements - show content improvement example
  if (
    insight.category === "ux" &&
    insight.description.toLowerCase().includes("bounce rate")
  ) {
    return `// Improve content engagement to reduce bounce rate
// Add more engaging elements to your page

export function EnhancedContent() {
  return (
    <section className="space-y-6">
      {/* Add interactive elements */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-xl font-semibold mb-3">Key Information</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          ${insight.suggestion.substring(0, 100)}...
        </p>
        <button className="px-4 py-2 rounded-lg bg-primary text-primary-foreground">
          Call to Action
        </button>
      </div>

      {/* Add clear navigation */}
      <nav className="flex gap-2">
        <a href="#" className="text-blue-600 hover:underline">Related Article</a>
        <a href="#" className="text-blue-600 hover:underline">Learn More</a>
      </nav>
    </section>
  )
}`
  }

  // For SEO improvements
  if (insight.category === "seo") {
    return `// Improve SEO metadata
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Page Title | Your Brand',
  description: '${insight.suggestion.substring(0, 100)}',
  keywords: ['keyword1', 'keyword2', 'keyword3'],
  openGraph: {
    title: 'Page Title',
    description: '${insight.suggestion.substring(0, 80)}',
    type: 'website',
  },
}

export default function Page() {
  return (
    <div>
      <h1>Main Heading</h1>
      <p>${insight.suggestion.substring(0, 80)}</p>
    </div>
  )
}`
  }

  // For performance improvements
  if (insight.category === "performance") {
    return `// Optimize for performance
import { Suspense } from 'react'
import dynamic from 'next/dynamic'

// Lazy load heavy components
const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <div>Loading...</div>,
  ssr: false,
})

export default function OptimizedPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HeavyComponent />
    </Suspense>
  )
}`
  }

  return null
}

interface Props {
  insight: AIInsight
}

export function InsightDetailsView({ insight }: Props) {
  const [copied, setCopied] = useState(false)
  const sev = SEVERITY_CONFIG[insight.severity]
  const cat = CATEGORY_CONFIG[insight.category]
  const SevIcon = sev.icon
  const CatIcon = cat.icon
  const codeSnippet = generateCodeSnippet(insight)

  const handleCopy = async () => {
    if (!codeSnippet) return
    try {
      await navigator.clipboard.writeText(codeSnippet)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
    }
  }

  return (
    <Card className={`overflow-hidden border ${sev.border} ${sev.bg}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <SevIcon
                className={`size-5 shrink-0 ${
                  insight.severity === "critical"
                    ? "text-red-500"
                    : insight.severity === "warning"
                      ? "text-amber-500"
                      : "text-blue-500"
                }`}
              />
              <CardTitle className="text-base">{insight.title}</CardTitle>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge variant="outline" className={`gap-1 ${sev.badge}`}>
                {CatIcon && <CatIcon className="size-3" />}
                {cat.label}
              </Badge>
              {insight.metric && (
                <Badge variant="secondary" className="text-xs">
                  {insight.metric}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Description */}
        <div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {insight.description}
          </p>
        </div>

        {/* Suggestion */}
        <div className="rounded-lg border border-border/50 bg-background/50 p-3.5">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Suggestion:</p>
          <p className="text-sm leading-relaxed">{insight.suggestion}</p>
        </div>

        {/* Code Snippet */}
        {codeSnippet && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Code className="size-3.5" />
                Implementation Example
              </p>
              <Button
                onClick={handleCopy}
                size="sm"
                variant="ghost"
                className="h-7 gap-1.5"
              >
                {copied ? (
                  <>
                    <Check className="size-3.5" />
                    <span className="text-xs">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" />
                    <span className="text-xs">Copy</span>
                  </>
                )}
              </Button>
            </div>
            <div className="rounded-lg border border-border/50 bg-muted/50 p-3 overflow-x-auto">
              <pre className="text-xs font-mono text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
                {codeSnippet}
              </pre>
            </div>
          </div>
        )}

        {/* External Link */}
        {insight.codeUrl && (
          <a
            href={insight.codeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
          >
            <ExternalLink className="size-3.5" />
            View in Repository
          </a>
        )}
      </CardContent>
    </Card>
  )
}
