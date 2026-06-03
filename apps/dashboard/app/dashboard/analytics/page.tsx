import { serverFetch } from "@/lib/server-api"
import { AnalyticsClient } from "./_components/analytics-client"

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
  overview: Overview
  webVitals: WebVitals
  dailyStats: DailyStat[]
  topPages: TopPage[]
  trafficSources: TrafficSource[]
  browsers: BrowserStat[]
  os: OsStat[]
  devices: DeviceStat[]
  countries: CountryStat[]
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; period?: string }>
}) {
  const params = await searchParams

  const { data: projects } = await serverFetch<Project[]>("/projects")

  const selectedProject = params.projectId || projects?.[0]?.id || ""
  const period = params.period || "7d"

  let initialData: AnalyticsData | null = null
  if (selectedProject && projects && projects.length > 0) {
    const result = await serverFetch<AnalyticsData>(
      `/analytics?projectId=${selectedProject}&period=${period}`,
    )
    initialData = result.data
  }

  return (
    <AnalyticsClient
      initialProjects={projects ?? []}
      initialSelectedProject={selectedProject}
      initialPeriod={period}
      initialData={initialData}
    />
  )
}
