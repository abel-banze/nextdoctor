"use client"

import * as React from "react"
import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts"
import { TrendingUp, TrendingDown, Minus, Calendar } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

interface DailyStat {
  date: string
  visitors: number
  sessions: number
  pageviews: number
}

interface Overview {
  totalVisitors: number
  totalSessions: number
  totalPageviews: number
  bounceRate: number
  avgSessionDuration: number
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const sec = Math.round(ms / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  const rem = sec % 60
  return `${min}m ${rem}s`
}

function calculateTrend(dailyStats: DailyStat[]): {
  direction: "up" | "down" | "flat"
  percent: number
} {
  if (dailyStats.length < 4) return { direction: "flat", percent: 0 }
  const mid = Math.floor(dailyStats.length / 2)
  const firstHalf = dailyStats.slice(0, mid)
  const secondHalf = dailyStats.slice(mid)
  const firstAvg =
    firstHalf.reduce((s, d) => s + d.visitors, 0) / firstHalf.length
  const secondAvg =
    secondHalf.reduce((s, d) => s + d.visitors, 0) / secondHalf.length
  if (firstAvg === 0) return { direction: "flat", percent: 0 }
  const change = ((secondAvg - firstAvg) / firstAvg) * 100
  return {
    direction: change > 1 ? "up" : change < -1 ? "down" : "flat",
    percent: Math.abs(Math.round(change)),
  }
}

function findPeakDay(
  dailyStats: DailyStat[],
): { date: string; visitors: number } | null {
  if (dailyStats.length === 0) return null
  return dailyStats.reduce((max, d) =>
    d.visitors > max.visitors ? d : max,
  )
}

export function ChartLineInteractive({
  data,
  overview,
}: {
  data: DailyStat[]
  overview: Overview
}) {
  const chartConfig = {
    visitors: {
      label: "Visitors",
      color: "var(--chart-1)",
    },
  } satisfies ChartConfig

  const totals = React.useMemo(
    () => ({
      visitors: data.reduce((acc, curr) => acc + curr.visitors, 0),
      sessions: data.reduce((acc, curr) => acc + curr.sessions, 0),
      pageviews: data.reduce((acc, curr) => acc + curr.pageviews, 0),
    }),
    [data],
  )

  const days = data.length || 1
  const avg = React.useMemo(
    () => ({
      visitors: Math.round(totals.visitors / days),
      sessions: Math.round(totals.sessions / days),
      pageviews: Math.round(totals.pageviews / days),
    }),
    [totals, days],
  )

  const activeToday = React.useMemo(
    () => (data.length > 0 ? data[data.length - 1].visitors : 0),
    [data],
  )

  const trend = React.useMemo(() => calculateTrend(data), [data])
  const peakDay = React.useMemo(() => findPeakDay(data), [data])

  const pagesPerSession =
    overview.totalSessions > 0
      ? (overview.totalPageviews / overview.totalSessions).toFixed(1)
      : "—"

  const TrendIcon =
    trend.direction === "up"
      ? TrendingUp
      : trend.direction === "down"
        ? TrendingDown
        : Minus

  const trendColor =
    trend.direction === "up"
      ? "text-emerald-500"
      : trend.direction === "down"
        ? "text-red-500"
        : "text-muted-foreground"

  const metrics = ["visitors", "sessions", "pageviews", "active"] as const

  return (
    <Card className="py-4 sm:py-0">
      <CardHeader className="flex flex-col items-stretch border-b p-0! sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 pb-3 sm:pb-0">
          <CardTitle>Traffic Overview</CardTitle>
          <CardDescription>
            {overview.bounceRate}% bounce rate · Avg session{" "}
            {formatDuration(overview.avgSessionDuration)}
          </CardDescription>
        </div>
        <div className="flex">
          {metrics.map((key) => (
            <div
              key={key}
              className="flex flex-1 flex-col justify-center gap-1 border-t px-6 py-2 text-left even:border-l sm:border-t-0 sm:border-l sm:px-8 sm:py-4"
            >
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {key === "active" && (
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                  </span>
                )}
                {key === "visitors"
                  ? "Visitors"
                  : key === "sessions"
                    ? "Sessions"
                    : key === "pageviews"
                      ? "Pageviews"
                      : "Active"}
              </span>
              <span className="text-lg leading-none font-bold tabular-nums font-mono sm:text-3xl">
                {key === "active"
                  ? activeToday.toLocaleString()
                  : totals[key].toLocaleString()}
              </span>
              <span className="text-[11px] tabular-nums font-mono text-muted-foreground">
                {key === "active"
                  ? "today"
                  : `${avg[key].toLocaleString()}/day`}
              </span>
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:p-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[300px] w-full"
        >
          <LineChart
            accessibilityLayer
            data={data}
            margin={{ left: 12, right: 12 }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={40}
              allowDecimals={false}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="w-[180px]"
                  indicator="line"
                  labelFormatter={(value) =>
                    new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  }
                />
              }
            />
            <Line
              dataKey="visitors"
              type="monotone"
              stroke="var(--color-visitors)"
              strokeWidth={3}
              dot={{ r: 3, strokeWidth: 2 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-wrap gap-x-6 gap-y-2 border-t text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Pages / Session</span>
          <span className="font-semibold tabular-nums font-mono">
            {pagesPerSession}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <TrendIcon className={`size-4 ${trendColor}`} />
          <span className="text-muted-foreground">Visitors</span>
          <span className={`font-semibold tabular-nums font-mono ${trendColor}`}>
            {trend.percent > 0 ? `${trend.percent}%` : "—"}
          </span>
          <span className="text-muted-foreground">vs earlier period</span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">Peak</span>
          <span className="font-semibold tabular-nums font-mono">
            {peakDay
              ? `${new Date(peakDay.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
              : "—"}
          </span>
          {peakDay && (
            <span className="tabular-nums font-mono text-muted-foreground">
              ({peakDay.visitors.toLocaleString()})
            </span>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}
