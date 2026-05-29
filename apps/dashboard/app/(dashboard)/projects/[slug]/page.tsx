import Link from "next/link"
import { notFound } from "next/navigation"
import { serverFetch } from "@/lib/server-api"

interface Project {
  id: string
  name: string
  slug: string
}

interface Issue {
  id: string
  detectorId: string
  severity: "info" | "warning" | "high" | "critical"
  message: string
  route: string | null
  count: number
  resolvedAt: string | null
}

interface IssuesResponse {
  issues: Issue[]
}

const severityColors: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  warning: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  info: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
}

type PageProps = {
  params: Promise<{ slug: string }>
  searchParams?: Promise<{ severity?: string }>
}

export default async function ProjectDetailPage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const { severity: severityFilter } = (await searchParams) ?? {}

  const { data: projects, error } = await serverFetch<Project[]>("/projects")

  if (error === "Unauthorized") return notFound()
  if (error) {
    return (
      <div className="mx-auto max-w-4xl py-10">
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      </div>
    )
  }

  const project = projects?.find((p) => p.slug === slug)
  if (!project) return notFound()

  const queryParams = new URLSearchParams({ projectId: project.id })
  if (severityFilter) queryParams.set("severity", severityFilter)

  const { data: issuesData } = await serverFetch<IssuesResponse>(`/issues?${queryParams.toString()}`)
  const issues = issuesData?.issues ?? []

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/projects" className="hover:text-foreground">Projects</Link>
            <span>/</span>
            <span className="text-foreground">{project.name}</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{project.name}</h1>
        </div>
        <Link
          href={`/projects/${slug}/settings`}
          className="inline-flex h-9 items-center justify-center rounded-lg border border-input bg-background px-4 text-sm font-medium transition-all hover:bg-muted"
        >
          Settings
        </Link>
      </div>

      {/* Severity filter */}
      <div className="mb-4 flex items-center gap-2">
        <Link
          href={`/projects/${slug}`}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${!severityFilter ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
        >
          All
        </Link>
        {(["critical", "high", "warning", "info"] as const).map((sev) => (
          <Link
            key={sev}
            href={`/projects/${slug}?severity=${sev}`}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${severityFilter === sev ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
          >
            {sev}
          </Link>
        ))}
      </div>

      {issues.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border bg-card p-12 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/></svg>
          <div>
            <h3 className="font-semibold">No issues detected</h3>
            <p className="text-sm text-muted-foreground">Once the agent starts sending data, issues will appear here.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-2">
          {issues.map((issue) => (
            <Link
              key={issue.id}
              href={`/projects/${slug}/issues/${issue.id}`}
              className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-accent/50"
            >
              <div className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${severityColors[issue.severity]}`}>
                {issue.severity}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{issue.message}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {issue.route ?? "Unknown route"} · Detected {issue.count} time{issue.count !== 1 ? "s" : ""}
                </p>
              </div>
              {issue.resolvedAt ? (
                <div className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  Resolved
                </div>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted-foreground"><polyline points="9 18 15 12 9 6"/></svg>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
