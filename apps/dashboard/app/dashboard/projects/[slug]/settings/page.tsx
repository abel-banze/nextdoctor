"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CopyButton } from "@/components/copy-button"
import { authClient } from "@/lib/auth-client"

interface Project {
  id: string
  name: string
  slug: string
}

interface Token {
  id: string
  hint: string
  label: string | null
  isActive: boolean
  lastUsedAt: string | null
  createdAt: string
}

interface GithubConnection {
  id: string
  projectId: string
  tenantId: string
  repoOwner: string
  repoName: string
  defaultBranch: string
  repoUrl: string | null
  isPrivate: boolean
  connectedAt: string
}

interface GithubRepository {
  id: number
  name: string
  owner: string
  fullName: string
  defaultBranch: string
  htmlUrl: string
  isPrivate: boolean
}

export default function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)
  const router = useRouter()

  const [project, setProject] = useState<Project | null>(null)
  const [tokens, setTokens] = useState<Token[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [rotating, setRotating] = useState(false)
  const [newToken, setNewToken] = useState<string | null>(null)
  const [githubConnection, setGithubConnection] = useState<GithubConnection | null>(null)
  const [githubRepositories, setGithubRepositories] = useState<GithubRepository[]>([])
  const [githubLoading, setGithubLoading] = useState(false)
  const [githubConnectLoading, setGithubConnectLoading] = useState(false)
  const [githubDisconnectLoading, setGithubDisconnectLoading] = useState(false)
  const [selectedRepo, setSelectedRepo] = useState("")
  const [githubAccountLoading, setGithubAccountLoading] = useState(false)

  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError("")

      try {
        const projectsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects`, {
          credentials: "include",
        })

        if (projectsRes.status === 401) {
          router.push("/auth/login")
          return
        }

        const projects: Project[] = await projectsRes.json()
        const found = projects.find((p) => p.slug === slug)

        if (!found) {
          setError("Project not found")
          setLoading(false)
          return
        }

        if (!cancelled) setProject(found)

        await loadGithubState(found.id)

        const tokensRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/projects/${found.id}/tokens`,
          { credentials: "include" },
        )

        if (tokensRes.ok && !cancelled) {
          const data = await tokensRes.json()
          setTokens(data.tokens ?? [])
        }
      } catch {
        if (!cancelled) setError("Connection error. Is the collector running?")
      }

      if (!cancelled) setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [slug, refreshKey, router])

  async function loadGithubState(projectId = project?.id) {
    if (!projectId) return

    setGithubLoading(true)

    try {
      const connectionRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/github`,
        { credentials: "include" },
      )

      if (connectionRes.ok) {
        const connectionData = await connectionRes.json()
        setGithubConnection(connectionData.connection)
      } else {
        const connectionData = await connectionRes.json().catch(() => null)
        if (connectionData?.error === "GitHub account not connected") {
          setGithubConnection(null)
        }
      }

      const repositoriesRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/github/repos`,
        { credentials: "include" },
      )

      if (repositoriesRes.ok) {
        const repositoriesData = await repositoriesRes.json()
        setGithubRepositories(repositoriesData.repositories ?? [])
      } else {
        setGithubRepositories([])
      }
    } catch {
      setGithubRepositories([])
    } finally {
      setGithubLoading(false)
    }
  }

  async function handleConnectGithubAccount() {
    setGithubAccountLoading(true)

    const { error } = await authClient.signIn.social({
      provider: "github",
      callbackURL: `/dashboard/projects/${slug}/settings`,
    })

    setGithubAccountLoading(false)

    if (error) {
      setError(error.message ?? "Failed to connect GitHub")
    }
  }

  async function handleConnectRepository() {
    if (!project) return

    const repository = githubRepositories.find((repo) => repo.fullName === selectedRepo)
    if (!repository) return

    setGithubConnectLoading(true)

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/${project.id}/github`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ owner: repository.owner, name: repository.name }),
        },
      )

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? "Failed to connect repository")
        return
      }

      setGithubConnection(data.connection)
      setSelectedRepo(data.connection?.repoOwner && data.connection?.repoName ? `${data.connection.repoOwner}/${data.connection.repoName}` : "")
      setRefreshKey((key) => key + 1)
    } catch {
      setError("Connection error. Is the collector running?")
    } finally {
      setGithubConnectLoading(false)
    }
  }

  async function handleDisconnectRepository() {
    if (!project) return

    setGithubDisconnectLoading(true)

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/${project.id}/github`,
        {
          method: "DELETE",
          credentials: "include",
        },
      )

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? "Failed to disconnect repository")
        return
      }

      setGithubConnection(null)
      setSelectedRepo("")
      setRefreshKey((key) => key + 1)
    } catch {
      setError("Connection error. Is the collector running?")
    } finally {
      setGithubDisconnectLoading(false)
    }
  }

  useEffect(() => {
    if (githubConnection) {
      setSelectedRepo(`${githubConnection.repoOwner}/${githubConnection.repoName}`)
      return
    }

    setSelectedRepo("")
  }, [githubConnection])

  async function handleRotate() {
    if (!project) return
    setRotating(true)
    setNewToken(null)

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/${project.id}/tokens`,
        { method: "POST", credentials: "include" },
      )

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Failed to rotate token")
        setRotating(false)
        return
      }

      const data = await res.json()
      setNewToken(data.token)
      setRefreshKey((k) => k + 1)
    } catch {
      setError("Connection error")
    }

    setRotating(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (error && !project) {
    return (
      <div className="mx-auto max-w-4xl py-10">
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/dashboard/projects" className="hover:text-foreground">Projects</Link>
          <span>/</span>
          <Link href={`/dashboard/projects/${slug}`} className="hover:text-foreground">{project?.name}</Link>
          <span>/</span>
          <span className="text-foreground">Settings</span>
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Project settings</h1>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Project info */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Details</h2>
        <div className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3 last:border-b-0">
            <span className="text-sm text-muted-foreground">Name</span>
            <span className="text-sm font-medium">{project?.name}</span>
          </div>
          <div className="flex items-center justify-between border-b px-4 py-3 last:border-b-0">
            <span className="text-sm text-muted-foreground">Slug</span>
            <span className="text-sm font-medium">{project?.slug}</span>
          </div>
        </div>
      </section>

      {/* GitHub repository */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">GitHub repository</h2>
          <button
            type="button"
            onClick={handleConnectGithubAccount}
            disabled={githubAccountLoading}
            className="inline-flex h-8 items-center justify-center rounded-lg border border-input bg-background px-3 text-xs font-medium transition-all hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
          >
            {githubAccountLoading ? "Connecting..." : githubConnection ? "Reconnect GitHub" : "Connect GitHub account"}
          </button>
        </div>

        <div className="rounded-xl border bg-card p-4">
          {githubLoading ? (
            <p className="text-sm text-muted-foreground">Loading GitHub status...</p>
          ) : githubConnection ? (
            <div className="flex flex-col gap-3">
              <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-300">
                Connected to <span className="font-semibold">{githubConnection.repoOwner}/{githubConnection.repoName}</span>
                {githubConnection.defaultBranch ? ` · ${githubConnection.defaultBranch}` : ""}
              </div>

              <div className="flex items-center gap-2">
                <label htmlFor="github-repo" className="text-sm font-medium">Switch repository</label>
                <select
                  id="github-repo"
                  value={selectedRepo}
                  onChange={(e) => setSelectedRepo(e.target.value)}
                  className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="">Select a repository</option>
                  {githubRepositories.map((repository) => (
                    <option key={repository.id} value={repository.fullName}>
                      {repository.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleConnectRepository}
                  disabled={githubConnectLoading || !selectedRepo}
                  className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80 disabled:pointer-events-none disabled:opacity-50"
                >
                  {githubConnectLoading ? "Saving..." : "Save repository"}
                </button>

                <button
                  type="button"
                  onClick={handleDisconnectRepository}
                  disabled={githubDisconnectLoading}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-input bg-background px-4 text-sm font-medium transition-all hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
                >
                  {githubDisconnectLoading ? "Disconnecting..." : "Disconnect"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Connect your GitHub account and choose the repository linked to this project.
              </p>

              <div className="flex flex-col gap-2">
                <label htmlFor="github-repo" className="text-sm font-medium">Repository</label>
                <select
                  id="github-repo"
                  value={selectedRepo}
                  onChange={(e) => setSelectedRepo(e.target.value)}
                  className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="">Select a repository</option>
                  {githubRepositories.map((repository) => (
                    <option key={repository.id} value={repository.fullName}>
                      {repository.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleConnectRepository}
                disabled={githubConnectLoading || !selectedRepo}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80 disabled:pointer-events-none disabled:opacity-50"
              >
                {githubConnectLoading ? "Saving..." : "Connect repository"}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* API tokens */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">API tokens</h2>
          <button
            type="button"
            onClick={handleRotate}
            disabled={rotating}
            className="inline-flex h-8 items-center justify-center rounded-lg border border-input bg-background px-3 text-xs font-medium transition-all hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
          >
            {rotating ? "Rotating..." : "Rotate all tokens"}
          </button>
        </div>

        {newToken && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900/50 dark:bg-green-950/30">
            <p className="mb-1 text-sm font-medium text-green-800 dark:text-green-300">New token created</p>
            <p className="mb-2 text-xs text-green-700 dark:text-green-400">
              This is the only time you will see this token. Copy it now.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-hidden text-ellipsis rounded-md bg-background px-3 py-2 text-sm font-mono">
                {newToken}
              </code>
              <CopyButton value={newToken!} label="Token copied" />
            </div>
          </div>
        )}

        <div className="rounded-xl border bg-card">
          {tokens.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No tokens yet. Create one to connect your Next.js app.
            </p>
          ) : (
            tokens.map((token) => (
              <div key={token.id} className="flex items-center justify-between border-b px-4 py-3 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{token.label ?? "Untitled"}</span>
                    {token.isActive ? (
                      <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ...{token.hint} · Created {new Date(token.createdAt).toLocaleDateString()}
                    {token.lastUsedAt && ` · Last used ${new Date(token.lastUsedAt).toLocaleDateString()}`}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Danger zone */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-destructive">Danger zone</h2>
        <div className="rounded-xl border border-destructive/20 bg-card p-4">
          <p className="mb-3 text-sm text-muted-foreground">
            Once deleted, all data for this project will be permanently removed.
          </p>
          <button
            type="button"
            disabled
            className="inline-flex h-8 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/10 px-3 text-xs font-medium text-destructive transition-all hover:bg-destructive/20 disabled:pointer-events-none disabled:opacity-50"
            title="Not yet implemented"
          >
            Delete project
          </button>
        </div>
      </section>
    </div>
  )
}
