"use client"

import { Zap, AlertTriangle, AlertCircle, Check } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface WebVitals {
  avgLcp: number
  avgCls: number
  avgFid: number
  avgInp: number
  avgTtfb: number
  avgFcp: number
  avgDomInteractive: number
}

interface Props {
  webVitals: WebVitals
}

const VITALS_CONFIG = [
  {
    label: "LCP",
    tooltip: "Largest Contentful Paint",
    key: "avgLcp" as const,
    unit: "ms",
    good: 2500,
    poor: 4000,
  },
  {
    label: "CLS",
    tooltip: "Cumulative Layout Shift",
    key: "avgCls" as const,
    unit: "",
    good: 0.1,
    poor: 0.25,
    precision: 2,
  },
  {
    label: "INP",
    tooltip: "Interaction to Next Paint",
    key: "avgInp" as const,
    unit: "ms",
    good: 200,
    poor: 500,
  },
  {
    label: "FID",
    tooltip: "First Input Delay",
    key: "avgFid" as const,
    unit: "ms",
    good: 100,
    poor: 300,
  },
  {
    label: "TTFB",
    tooltip: "Time to First Byte",
    key: "avgTtfb" as const,
    unit: "ms",
    good: 600,
    poor: 1200,
  },
  {
    label: "FCP",
    tooltip: "First Contentful Paint",
    key: "avgFcp" as const,
    unit: "ms",
    good: 1800,
    poor: 3000,
  },
]

function getVitalStatus(value: number, good: number, poor: number): "good" | "warning" | "poor" {
  if (value <= good) return "good"
  if (value <= poor) return "warning"
  return "poor"
}

function formatValue(value: number, precision?: number): string {
  if (precision !== undefined) {
    return value.toFixed(precision)
  }
  return Math.round(value).toString()
}

export function WebVitalsCard({ webVitals }: Props) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="size-4 text-amber-500" />
          <h3 className="font-semibold text-sm">Core Web Vitals</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {VITALS_CONFIG.map((config) => {
            const value = webVitals[config.key]
            const status = getVitalStatus(value, config.good, config.poor)
            const statusConfig = {
              good: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-600 dark:text-emerald-400", icon: Check },
              warning: { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-600 dark:text-amber-400", icon: AlertCircle },
              poor: { bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-600 dark:text-red-400", icon: AlertTriangle },
            }
            const { bg, border, text, icon: StatusIcon } = statusConfig[status]

            return (
              <div
                key={config.key}
                className={`rounded-lg border ${border} ${bg} p-3 transition-colors hover:bg-opacity-75`}
                title={config.tooltip}
              >
                <div className="flex items-start justify-between gap-1 mb-2">
                  <span className="text-xs font-bold text-muted-foreground">{config.label}</span>
                  <StatusIcon className={`size-3.5 shrink-0 ${text}`} />
                </div>
                <div className="space-y-0.5">
                  <p className={`text-base font-bold ${text}`}>
                    {formatValue(value, config.precision)}
                    <span className="text-xs font-normal text-muted-foreground">{config.unit}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {status === "good" && "Good"}
                    {status === "warning" && "Needs improvement"}
                    {status === "poor" && "Poor"}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold">Core Web Vitals</span> are key metrics that measure user experience. Improve these scores to boost your site's ranking and user satisfaction.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
