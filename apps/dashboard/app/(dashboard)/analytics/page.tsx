"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  Cell,
} from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Card, CardContent } from "@/components/ui/card"
import {
  Users,
  Eye,
  Activity,
  TrendingUp,
  MousePointerClick,
  Monitor,
  Smartphone,
  Tablet,
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

const DESKTOP_COLORS: Record<string, string> = {
  Chrome: "#3b82f6",
  Firefox: "#f59e0b",
  Safari: "#06b6d4",
  Edge: "#22c55e",
  Opera: "#a855f7",
}

const OS_COLORS: Record<string, string> = {
  Windows: "#3b82f6",
  macOS: "#a855f7",
  Linux: "#f59e0b",
  iOS: "#06b6d4",
  Android: "#22c55e",
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const sec = Math.round(ms / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  const rem = sec % 60
  return `${min}m ${rem}s`
}

function pluralize(n: number, singular: string, plural?: string): string {
  return n === 1 ? singular : plural ?? `${singular}s`
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

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  sub?: string
}) {
  return (
    <Card className="transition-colors hover:bg-accent/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="size-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <p className="text-xl font-bold tabular-nums tracking-tight">
              {value}
            </p>
            {sub && (
              <p className="text-xs text-muted-foreground">{sub}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function AnalyticsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<string>("")
  const [period, setPeriod] = useState("7d")
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((list) => {
        setProjects(list ?? [])
        if (list?.length > 0) setSelectedProject(list[0].id)
      })
      .catch(() => setProjects([]))
  }, [])

  const fetchAnalytics = useCallback(async () => {
    if (!selectedProject) return
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

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  // ── Chart configs ──────────────────────────────────────────────────────────
  const visitorsChartConfig: ChartConfig = {
    visitors: { label: "Visitors", color: "hsl(var(--primary))" },
    sessions: { label: "Sessions", color: "#06b6d4" },
    pageviews: { label: "Pageviews", color: "#a855f7" },
  }

  const pagesChartConfig: ChartConfig = {
    pages: { label: "Pageviews", color: "hsl(var(--primary))" },
  }

  const sourcesConfig: ChartConfig = Object.fromEntries(
    Object.entries(SOURCE_COLORS).map(([key, color]) => [
      key,
      { label: SOURCE_LABELS[key] ?? key, color },
    ]),
  )

  const browsersConfig: ChartConfig = {
    Chrome: { label: "Chrome", color: DESKTOP_COLORS.Chrome },
    Firefox: { label: "Firefox", color: DESKTOP_COLORS.Firefox },
    Safari: { label: "Safari", color: DESKTOP_COLORS.Safari },
    Edge: { label: "Edge", color: DESKTOP_COLORS.Edge },
  }

  const osConfig: ChartConfig = {
    Windows: { label: "Windows", color: OS_COLORS.Windows },
    macOS: { label: "macOS", color: OS_COLORS.macOS },
    Linux: { label: "Linux", color: OS_COLORS.Linux },
    iOS: { label: "iOS", color: OS_COLORS.iOS },
    Android: { label: "Android", color: OS_COLORS.Android },
  }

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

        <div className="flex items-center gap-2">
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent"
          >
            {projects.length === 0 && (
              <option value="">No projects</option>
            )}
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <div className="flex rounded-lg border border-input bg-background p-0.5">
            {(["7d", "30d", "90d"] as const).map((p) => (
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
        </div>
      </div>

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

      {loading && selectedProject && (
        <div className="flex items-center justify-center py-20">
          <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {data && !loading && (
        <>
          {/* Stat Cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={Users}
              label="Visitors"
              value={data.overview.totalVisitors.toLocaleString()}
              sub={pluralize(data.overview.totalVisitors, "unique visitor")}
            />
            <StatCard
              icon={MousePointerClick}
              label="Sessions"
              value={data.overview.totalSessions.toLocaleString()}
              sub={pluralize(data.overview.totalSessions, "session")}
            />
            <StatCard
              icon={Eye}
              label="Pageviews"
              value={data.overview.totalPageviews.toLocaleString()}
              sub={pluralize(data.overview.totalPageviews, "pageview")}
            />
            <StatCard
              icon={TrendingUp}
              label="Bounce Rate"
              value={`${data.overview.bounceRate}%`}
              sub={`Avg session: ${formatDuration(data.overview.avgSessionDuration)}`}
            />
          </div>

          {/* Daily visitors chart */}
          <Card>
            <CardContent className="p-4">
              <h3 className="mb-3 text-sm font-semibold">Daily Visitors &amp; Sessions</h3>
              <ChartContainer config={visitorsChartConfig} className="aspect-[3/1]">
                <LineChart data={data.dailyStats} accessibilityLayer>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="visitors"
                    stroke="var(--color-visitors)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="sessions"
                    stroke="var(--color-sessions)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Two-column layout */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Top pages */}
            <Card>
              <CardContent className="p-4">
                <h3 className="mb-3 text-sm font-semibold">Top Pages</h3>
                {data.topPages.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No pageview data yet</p>
                ) : (
                  <ChartContainer config={pagesChartConfig} className="aspect-[2/1]">
                    <BarChart data={data.topPages} layout="vertical" accessibilityLayer>
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar
                        dataKey="count"
                        fill="var(--color-pages)"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Traffic sources */}
            <Card>
              <CardContent className="p-4">
                <h3 className="mb-3 text-sm font-semibold">Traffic Sources</h3>
                {data.trafficSources.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No traffic data yet</p>
                ) : (
                  <div className="space-y-2">
                    <ChartContainer config={sourcesConfig} className="aspect-[2/1]">
                      <PieChart>
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Pie
                          data={data.trafficSources}
                          dataKey="count"
                          nameKey="source"
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={90}
                        >
                          {data.trafficSources.map((entry) => (
                            <Cell
                              key={entry.source}
                              fill={SOURCE_COLORS[entry.source] ?? "#94a3b8"}
                            />
                          ))}
                        </Pie>
                      </PieChart>
                    </ChartContainer>
                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
                      {data.trafficSources.map((entry) => {
                        const Icon = SOURCE_ICONS[entry.source]
                        const total = data.trafficSources.reduce((s, x) => s + x.count, 0)
                        const pct = total > 0 ? Math.round((entry.count / total) * 100) : 0
                        return (
                          <div key={entry.source} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            {Icon && <Icon className="size-3" />}
                            <span className="capitalize">{SOURCE_LABELS[entry.source] ?? entry.source}</span>
                            <span className="font-medium text-foreground">{pct}%</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Browsers */}
            <Card>
              <CardContent className="p-4">
                <h3 className="mb-3 text-sm font-semibold">Browsers</h3>
                {data.browsers.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No data</p>
                ) : (
                  <ChartContainer config={browsersConfig} className="aspect-[2/1]">
                    <BarChart data={data.browsers} layout="vertical" accessibilityLayer>
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar
                        dataKey="count"
                        radius={[0, 4, 4, 0]}
                      >
                        {data.browsers.map((entry) => (
                          <Cell
                            key={entry.browser}
                            fill={DESKTOP_COLORS[entry.browser] ?? "#94a3b8"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* OS */}
            <Card>
              <CardContent className="p-4">
                <h3 className="mb-3 text-sm font-semibold">Operating Systems</h3>
                {data.os.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No data</p>
                ) : (
                  <ChartContainer config={osConfig} className="aspect-[2/1]">
                    <BarChart data={data.os} layout="vertical" accessibilityLayer>
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar
                        dataKey="count"
                        radius={[0, 4, 4, 0]}
                      >
                        {data.os.map((entry) => (
                          <Cell
                            key={entry.os}
                            fill={OS_COLORS[entry.os] ?? "#94a3b8"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Devices */}
            <Card>
              <CardContent className="p-4">
                <h3 className="mb-3 text-sm font-semibold">Devices</h3>
                {data.devices.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No data</p>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {data.devices.map((d) => {
                      const total = data.devices.reduce((s, x) => s + x.count, 0)
                      const pct = total > 0 ? Math.round((d.count / total) * 100) : 0
                      const Icon =
                        d.device === "mobile"
                          ? Smartphone
                          : d.device === "tablet"
                            ? Tablet
                            : Monitor
                      return (
                        <div
                          key={d.device}
                          className="flex flex-col items-center gap-2 rounded-lg border bg-card p-4"
                        >
                          <Icon className="size-6 text-muted-foreground" />
                          <span className="text-sm font-medium capitalize">
                            {d.device}
                          </span>
                          <span className="text-2xl font-bold tabular-nums">
                            {pct}%
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {d.count.toLocaleString()} {pluralize(d.count, "visitor")}
                          </span>
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
                      const pct = total > 0 ? Math.round((c.count / total) * 100) : 0
                      return (
                        <div key={c.country} className="flex items-center gap-3">
                          <FlagIcon code={c.country} className="size-5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-sm font-medium">{c.country}</span>
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {c.count.toLocaleString()}
                              </span>
                            </div>
                            <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
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
