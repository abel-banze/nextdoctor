import Link from "next/link"
import { notFound } from "next/navigation"
import { serverFetch } from "@/lib/server-api"
import { IssueActions } from "./_components/issue-actions"

interface Issue {
  id: string
  detectorId: string
  severity: "info" | "warning" | "high" | "critical"
  message: string
  suggestion: string
  route: string | null
  count: number
  firstDetectedAt: string
  lastDetectedAt: string
  resolvedAt: string | null
}

interface IssuesResponse {
  issues: Issue[]
}

interface AiAnalysis {
  id: string
  explanation: string | null
  diff: string | null
  fixedSnippet: string | null
  filePath: string | null
  startLine: number | null
  endLine: number | null
  status: "pending" | "completed" | "failed"
  model: string | null
}

const severityColors: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  warning: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  info: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
}

type PageProps = { params: Promise<{ slug: string; id: string }> }

export default async function IssueDetailPage({ params }: PageProps) {
  const { id } = await params

  const { data: issueData, error } = await serverFetch<IssuesResponse>(`/issues?id=${id}`)
  const issue = issueData?.issues?.[0] ?? null

  if (error === "Unauthorized" || !issue) return notFound()
  if (error) {
    return (
      <div className="mx-auto max-w-4xl py-10">
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      </div>
    )
  }

  const { data: analysis, error: analysisError } = await serverFetch<AiAnalysis>(`/ai/analyses/${issue.id}`)
  const hasAnalysis = analysis !== null && analysisError === null

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/dashboard/projects" className="hover:text-foreground">Projects</Link>
          <span>/</span>
          <Link href={`/dashboard/projects/${issue.route ?? ""}`} className="hover:text-foreground">{issue.route ?? ""}</Link>
          <span>/</span>
          <span className="text-foreground">Issue</span>
        </div>
      </div>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${severityColors[issue.severity]}`}>
              {issue.severity}
            </span>
            <span className="text-xs text-muted-foreground">{issue.detectorId}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{issue.message}</h1>
          {issue.route && (
            <p className="mt-1 text-sm text-muted-foreground">
              Route: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{issue.route}</code>
            </p>
          )}
        </div>

        <IssueActions issueId={issue.id} resolvedAt={issue.resolvedAt} />
      </div>

      <div className="grid gap-6">
        {/* Suggestion */}
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">Suggestion</h2>
          <p className="text-sm whitespace-pre-wrap">{issue.suggestion}</p>
        </section>

        {/* AI Doctor */}
        {hasAnalysis && (
          <section className="rounded-xl border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                AI Doctor {analysis.model ? `(${analysis.model})` : ""}
              </h2>
              <AiStatusBadge status={analysis.status} />
            </div>

            {analysis.status === "pending" && <AiPendingState />}
            {analysis.status === "completed" && <AiCompletedState analysis={analysis} />}
            {analysis.status === "failed" && (
              <p className="text-sm text-destructive">AI analysis failed. Please try again.</p>
            )}
          </section>
        )}

        {/* Metadata */}
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">Details</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Detected</span>
              <p className="font-medium">{new Date(issue.firstDetectedAt).toLocaleString()}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Last seen</span>
              <p className="font-medium">{new Date(issue.lastDetectedAt).toLocaleString()}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Occurrences</span>
              <p className="font-medium">{issue.count}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Status</span>
              <p className="font-medium">{issue.resolvedAt ? "Resolved" : "Active"}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function AiStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? ""}`}>
      {status}
    </span>
  )
}

function AiPendingState() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      Analyzing...
    </div>
  )
}

function AiCompletedState({ analysis }: { analysis: AiAnalysis }) {
  return (
    <div className="flex flex-col gap-4">
      {analysis.explanation && (
        <div>
          <h3 className="mb-1 text-xs font-semibold text-muted-foreground uppercase">Explanation</h3>
          <p className="text-sm">{analysis.explanation}</p>
        </div>
      )}
      {analysis.filePath && (
        <div>
          <h3 className="mb-1 text-xs font-semibold text-muted-foreground uppercase">Location</h3>
          <p className="text-sm font-mono">
            {analysis.filePath}
            {analysis.startLine && `:${analysis.startLine}`}
            {analysis.endLine && analysis.endLine !== analysis.startLine && `-${analysis.endLine}`}
          </p>
        </div>
      )}
      {analysis.diff && (
        <div>
          <h3 className="mb-1 text-xs font-semibold text-muted-foreground uppercase">Fix (diff)</h3>
          <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs font-mono leading-relaxed">{analysis.diff}</pre>
        </div>
      )}
      {analysis.fixedSnippet && (
        <div>
          <h3 className="mb-1 text-xs font-semibold text-muted-foreground uppercase">Fixed code</h3>
          <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-sm font-mono leading-relaxed">{analysis.fixedSnippet}</pre>
        </div>
      )}
    </div>
  )
}
