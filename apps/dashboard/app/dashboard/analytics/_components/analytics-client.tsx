"use client"

import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  XAxis,
  YAxis,
} from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChartLineInteractive } from "@/components/ui/chart-line-interactive"
import { AnalyticsAiInsights } from "./analytics-ai-insights"
import {
  Activity,
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  ExternalLink,
  TrendingUp,
} from "lucide-react"
import {
  FaGlobeAmericas,
  FaGoogle,
  FaShareAlt,
  FaLink,
  FaBullseye,
  FaMoneyBillWave,
  FaMailBulk,
  FaAd,
  FaChrome,
  FaFirefox,
  FaSafari,
  FaEdge,
  FaOpera,
  FaWindows,
  FaLinux,
  FaApple,
  FaAndroid,
} from "react-icons/fa"
import * as flags from "country-flag-icons/string/3x2"

interface Project {
  id: string
  name: string
  slug: string
}

interface Overview {
  totalVisitors: number
  totalSessions: number
  totalPageviews: number
  bounceRate: number
  avgSessionDuration: number
}

interface DailyStat {
  date: string
  visitors: number
  sessions: number
  pageviews: number
}

interface TopPage {
  url: string
  count: number
}

interface TrafficSource {
  source: string
  count: number
}

interface BrowserStat {
  browser: string
  count: number
}

interface OsStat {
  os: string
  count: number
}

interface DeviceStat {
  device: string
  count: number
}

interface CountryStat {
  country: string
  count: number
}

interface AnalyticsData {
  overview: Overview
  dailyStats: DailyStat[]
  topPages: TopPage[]
  trafficSources: TrafficSource[]
  browsers: BrowserStat[]
  os: OsStat[]
  devices: DeviceStat[]
  countries: CountryStat[]
}

const SOURCE_COLORS: Record<string, string> = {
  direct: "#94a3b8",
  organic: "#22c55e",
  social: "#3b82f6",
  paid: "#f59e0b",
  email: "#a855f7",
  referral: "#06b6d4",
  utm: "#ec4899",
  display: "#f97316",
}

const SOURCE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  direct: FaGlobeAmericas,
  organic: FaGoogle,
  social: FaShareAlt,
  paid: FaMoneyBillWave,
  email: FaMailBulk,
  referral: FaLink,
  utm: FaBullseye,
  display: FaAd,
}

const SOURCE_LABELS: Record<string, string> = {
  direct: "Direct",
  organic: "Organic Search",
  social: "Social",
  paid: "Paid",
  email: "Email",
  referral: "Referral",
  utm: "UTM Campaign",
  display: "Display",
  unknown: "Unknown",
}

const BROWSER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Chrome: FaChrome,
  Firefox: FaFirefox,
  Safari: FaSafari,
  Edge: FaEdge,
  Opera: FaOpera,
}

const BROWSER_COLORS: Record<string, string> = {
  Chrome: "#3b82f6",
  Firefox: "#f59e0b",
  Safari: "#06b6d4",
  Edge: "#22c55e",
  Opera: "#a855f7",
}

const OS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Windows: FaWindows,
  macOS: FaApple,
  Linux: FaLinux,
  iOS: FaApple,
  Android: FaAndroid,
}

const OS_COLORS: Record<string, string> = {
  Windows: "#3b82f6",
  macOS: "#a855f7",
  Linux: "#f59e0b",
  iOS: "#06b6d4",
  Android: "#22c55e",
}

const DEVICE_COLORS: Record<string, string> = {
  desktop: "#3b82f6",
  mobile: "#22c55e",
  tablet: "#a855f7",
}

const DEVICE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
}

const PERIODS = ["7d", "30d", "90d"] as const

function pluralize(n: number, singular: string, plural?: string): string {
  return n === 1 ? singular : plural ?? `${singular}s`
}

function extractPath(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.pathname === "/" ? "/" : parsed.pathname.replace(/\/$/, "")
  } catch {
    return url.startsWith("/") ? url : `/${url}`
  }
}

function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url)
    return parsed.hostname
  } catch {
    return null
  }
}

function FlagIcon({ code, className }: { code: string; className?: string }) {
  const svg = flags[code as keyof typeof flags]
  if (!svg) return <span className={`inline-block size-5 rounded bg-muted ${className ?? ""}`} />
  return (
    <span
      className={`inline-block overflow-hidden rounded ${className ?? "size-5"}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

function StatBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="h-2 w-full rounded-full bg-muted">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  )
}

interface Props {
  initialProjects: Project[]
  initialSelectedProject: string
  initialPeriod: string
  initialData: AnalyticsData | null
}

export function AnalyticsClient({
  initialProjects,
  initialSelectedProject,
  initialPeriod,
  initialData,
}: Props) {
  const [projects] = useState<Project[]>(initialProjects)
  const [selectedProject, setSelectedProject] = useState(initialSelectedProject)
  const [period, setPeriod] = useState(initialPeriod)
  const [deviceFilter, setDeviceFilter] = useState<string>("all")
  const [sourceFilter, setSourceFilter] = useState<string>("all")
  const [data, setData] = useState<AnalyticsData | null>(initialData)
  const [loading, setLoading] = useState(false)

  const fetchAnalytics = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/analytics?projectId=${selectedProject}&period=${period}`,
      )
      if (!res.ok) {
        setData(null)
        return
      }
      const json = await res.json()
      setData(json)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [selectedProject, period])

  const mounted = useRef(false)
  useEffect(() => {
    if (!selectedProject) return
    if (!mounted.current) {
      mounted.current = true
      if (initialData) return
    }
    fetchAnalytics()
  }, [selectedProject, period, fetchAnalytics])

  useEffect(() => {
    if (!selectedProject) return
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchAnalytics()
      }
    }, 60000)
    return () => clearInterval(interval)
  }, [selectedProject, period, fetchAnalytics])

  const sourcesConfig: ChartConfig = useMemo(
    () => ({
      label: { color: "var(--background)" },
      ...Object.fromEntries(
        Object.entries(SOURCE_COLORS).map(([key, color]) => [
          key,
          { label: SOURCE_LABELS[key] ?? key, color },
        ]),
      ),
    }),
    [],
  )

  const filteredTrafficSources = useMemo(() => {
    if (!data?.trafficSources) return []
    if (sourceFilter === "all") return data.trafficSources
    return data.trafficSources.filter((s) => s.source === sourceFilter)
  }, [data?.trafficSources, sourceFilter])

  const filteredDevices = useMemo(() => {
    if (!data?.devices) return []
    if (deviceFilter === "all") return data.devices
    return data.devices.filter((d) => d.device === deviceFilter)
  }, [data?.devices, deviceFilter])

  const totalSourceCount = useMemo(
    () => data?.trafficSources.reduce((s, x) => s + x.count, 0) ?? 0,
    [data?.trafficSources],
  )

  const totalPageviews = useMemo(
    () => data?.topPages.reduce((s, x) => s + x.count, 0) ?? 0,
    [data?.topPages],
  )

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Visitor insights and traffic metrics
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {projects.length > 0 && (
            <Select
              value={selectedProject}
              onValueChange={(v) => v && setSelectedProject(v)}
            >
              <SelectTrigger className="w-44">
                <span>{projects.find((p) => p.id === selectedProject)?.name ?? "Project"}</span>
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="flex rounded-lg border border-input bg-background p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                data-active={period === p || undefined}
                className="rounded-md px-3 py-1.5 text-xs font-medium transition-colors data-[active]:bg-primary data-[active]:text-primary-foreground hover:bg-muted"
              >
                {p}
              </button>
            ))}
          </div>

          <Select value={deviceFilter} onValueChange={(v) => v && setDeviceFilter(v)}>
            <SelectTrigger className="w-28">
              <span>
                {deviceFilter === "all"
                  ? "Device"
                  : deviceFilter.charAt(0).toUpperCase() + deviceFilter.slice(1)}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All devices</SelectItem>
              <SelectItem value="desktop">Desktop</SelectItem>
              <SelectItem value="mobile">Mobile</SelectItem>
              <SelectItem value="tablet">Tablet</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sourceFilter} onValueChange={(v) => v && setSourceFilter(v)}>
            <SelectTrigger className="w-32">
              <span>{sourceFilter === "all" ? "Source" : SOURCE_LABELS[sourceFilter] ?? sourceFilter}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {Object.entries(SOURCE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* AI Insights */}
      {data && !loading && selectedProject && (
        <AnalyticsAiInsights projectId={selectedProject} analytics={data} />
      )}

      {/* Loading / Empty */}
      {!selectedProject && projects.length === 0 && !loading && (
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-12 text-center">
          <Activity className="size-8 text-muted-foreground" />
          <div>
            <h3 className="font-semibold">No projects yet</h3>
            <p className="text-sm text-muted-foreground">
              Create a project and install the agent to start collecting analytics.
            </p>
          </div>
        </div>
      )}

      {loading && selectedProject && <AnalyticsSkeleton />}

      {data && !loading && (
        <>
          {/* Traffic chart */}
          <ChartLineInteractive data={data.dailyStats} overview={data.overview} />

          {/* Two-column layout */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Top Pages */}
            <Card>
              <CardContent className="p-4">
                <h3 className="mb-3 text-sm font-semibold">
                  Top Pages
                  {(() => {
                    const domain = extractDomain(data.topPages[0]?.url ?? "")
                    return domain ? <span className="ml-1 font-normal text-muted-foreground">— {domain}</span> : null
                  })()}
                </h3>
                {data.topPages.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No pageview data yet</p>
                ) : (
                  <ScrollArea className="h-[320px]">
                    <div className="space-y-0">
                      {data.topPages.slice(0, 10).map((page, i) => {
                      const pct = totalPageviews > 0 ? (page.count / totalPageviews) * 100 : 0
                      return (
                        <div
                          key={page.url}
                          className="flex items-center gap-3 border-b py-2.5 last:border-0"
                        >
                          <span className="w-5 text-center text-xs tabular-nums font-mono text-muted-foreground">
                            {i + 1}
                          </span>
                          <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="truncate text-sm font-medium">{extractPath(page.url)}</span>
                              <span className="shrink-0 text-xs tabular-nums font-mono text-muted-foreground">
                                {page.count.toLocaleString()}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center gap-2">
                              <StatBar value={page.count} max={data.topPages[0].count} color="hsl(var(--primary))" />
                              <span className="w-10 text-right text-xs tabular-nums font-mono text-muted-foreground">
                                {pct.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* Traffic sources */}
            <Card>
              <CardHeader>
                <CardTitle>Traffic Sources</CardTitle>
                <CardDescription>Breakdown by source channel</CardDescription>
              </CardHeader>
              <CardContent>
                {filteredTrafficSources.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No traffic data yet</p>
                ) : (
                  <ChartContainer config={sourcesConfig}>
                    <BarChart
                      accessibilityLayer
                      data={filteredTrafficSources.map((s) => ({
                        ...s,
                        fill: SOURCE_COLORS[s.source] ?? "#94a3b8",
                      }))}
                      layout="vertical"
                      margin={{ right: 16 }}
                    >
                      <CartesianGrid horizontal={false} />
                      <YAxis
                        dataKey="source"
                        type="category"
                        tickLine={false}
                        tickMargin={10}
                        axisLine={false}
                        hide
                      />
                      <XAxis dataKey="count" type="number" hide />
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent indicator="line" />}
                      />
                      <Bar dataKey="count" radius={4}>
                        <LabelList
                          dataKey="source"
                          position="insideLeft"
                          offset={8}
                          className="fill-(--color-label)"
                          fontSize={12}
                        />
                        <LabelList
                          dataKey="count"
                          position="right"
                          offset={8}
                          className="fill-foreground"
                          fontSize={12}
                        />
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
              <CardFooter className="flex-col items-start gap-2 text-sm">
                {filteredTrafficSources.length > 0 && (() => {
                  const top = filteredTrafficSources.reduce((a, b) => (a.count > b.count ? a : b))
                  const pct = totalSourceCount > 0 ? Math.round((top.count / totalSourceCount) * 100) : 0
                  const TopIcon = SOURCE_ICONS[top.source]
                  return (
                    <div className="flex gap-2 leading-none font-medium">
                      {TopIcon && <TopIcon className="size-4" />}
                      Top source: {SOURCE_LABELS[top.source] ?? top.source} — {pct}% of traffic
                    </div>
                  )
                })()}
              </CardFooter>
            </Card>

            {/* Browsers (list with icons) */}
            <Card>
              <CardContent className="p-4">
                <h3 className="mb-3 text-sm font-semibold">Browsers</h3>
                {data.browsers.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No data</p>
                ) : (
                  <div className="space-y-2">
                    {data.browsers.map((b) => {
                      const Icon = BROWSER_ICONS[b.browser]
                      const total = data.browsers.reduce((s, x) => s + x.count, 0)
                      const pct = total > 0 ? (b.count / total) * 100 : 0
                      const color = BROWSER_COLORS[b.browser] ?? "#94a3b8"
                      return (
                        <div key={b.browser} className="flex items-center gap-3">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-card">
                            {Icon ? <span style={{ color }}><Icon className="size-4" /></span> : <Globe className="size-4 text-muted-foreground" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-sm font-medium">{b.browser}</span>
                              <span className="text-xs tabular-nums font-mono text-muted-foreground">
                                {b.count.toLocaleString()} ({pct.toFixed(1)}%)
                              </span>
                            </div>
                            <StatBar value={b.count} max={data.browsers[0].count} color={color} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* OS (list with icons) */}
            <Card>
              <CardContent className="p-4">
                <h3 className="mb-3 text-sm font-semibold">Operating Systems</h3>
                {data.os.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No data</p>
                ) : (
                  <div className="space-y-2">
                    {data.os.map((os) => {
                      const Icon = OS_ICONS[os.os]
                      const total = data.os.reduce((s, x) => s + x.count, 0)
                      const pct = total > 0 ? (os.count / total) * 100 : 0
                      const color = OS_COLORS[os.os] ?? "#94a3b8"
                      return (
                        <div key={os.os} className="flex items-center gap-3">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-card">
                            {Icon ? <span style={{ color }}><Icon className="size-4" /></span> : <Monitor className="size-4 text-muted-foreground" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-sm font-medium">{os.os}</span>
                              <span className="text-xs tabular-nums font-mono text-muted-foreground">
                                {os.count.toLocaleString()} ({pct.toFixed(1)}%)
                              </span>
                            </div>
                            <StatBar value={os.count} max={data.os[0].count} color={color} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Devices */}
            <Card>
              <CardContent className="p-4">
                <h3 className="mb-3 text-sm font-semibold">Devices</h3>
                {filteredDevices.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No data</p>
                ) : (
                  <div className="space-y-2">
                    {filteredDevices.map((d) => {
                      const total = data.devices.reduce((s, x) => s + x.count, 0)
                      const pct = total > 0 ? (d.count / total) * 100 : 0
                      const Icon = DEVICE_ICONS[d.device] ?? Monitor
                      const color = DEVICE_COLORS[d.device] ?? "#94a3b8"
                      return (
                        <div key={d.device} className="flex items-center gap-3">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-card">
                            <span style={{ color }}><Icon className="size-4" /></span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-sm font-medium capitalize">{d.device}</span>
                              <span className="text-xs tabular-nums font-mono text-muted-foreground">
                                {d.count.toLocaleString()} ({pct.toFixed(1)}%)
                              </span>
                            </div>
                            <StatBar value={d.count} max={filteredDevices[0].count} color={color} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Countries */}
            <Card>
              <CardContent className="p-4">
                <h3 className="mb-3 text-sm font-semibold">Top Countries</h3>
                {data.countries.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No country data yet</p>
                ) : (
                  <div className="space-y-2.5">
                    {data.countries.map((c) => {
                      const total = data.countries.reduce((s, x) => s + x.count, 0)
                      const pct = total > 0 ? (c.count / total) * 100 : 0
                      return (
                        <div key={c.country} className="flex items-center gap-3">
                          <FlagIcon code={c.country} className="size-5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-sm font-medium">{c.country}</span>
                              <span className="text-xs tabular-nums font-mono text-muted-foreground">
                                {c.count.toLocaleString()}
                                <span className="ml-1">({pct.toFixed(1)}%)</span>
                              </span>
                            </div>
                            <StatBar value={c.count} max={data.countries[0].count} color="hsl(var(--primary))" />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Chart skeleton */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <div className="mb-1 h-4 w-36 animate-pulse rounded bg-muted" />
            <div className="h-3 w-48 animate-pulse rounded bg-muted" />
          </div>
          <div className="flex gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-8 w-20 animate-pulse rounded bg-muted" />
            ))}
          </div>
        </div>
        <div className="mt-4 aspect-[3/1] animate-pulse rounded-lg bg-muted/50" />
      </div>

      {/* Two-column skeletons */}
      <div className="grid gap-4 lg:grid-cols-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4">
            <div className="mb-4 h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="space-y-3">
              {[...Array(5)].map((_, j) => (
                <div key={j} className="h-8 animate-pulse rounded bg-muted/50" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
