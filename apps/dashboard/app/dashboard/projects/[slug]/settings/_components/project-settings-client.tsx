"use client"

import { useState, useMemo, useCallback } from "react"
import Link from "next/link"
import { CopyButton } from "@/components/copy-button"
import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { authClient } from "@/lib/auth-client"
import { FaGithub } from "react-icons/fa"
import { GitBranch, Plus, Loader2, Check } from "lucide-react"

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

export function ProjectSettingsClient({
  project,
  initialTokens,
  initialGithubConnection,
  initialGithubRepositories,
  showHeading = true,
}: {
  project: Project
  initialTokens: Token[]
  initialGithubConnection: GithubConnection | null
  initialGithubRepositories: GithubRepository[]
  showHeading?: boolean
}) {
  const [tokens, setTokens] = useState<Token[]>(initialTokens)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [rotating, setRotating] = useState(false)
  const [newToken, setNewToken] = useState<string | null>(null)
  const [githubConnection, setGithubConnection] = useState<GithubConnection | null>(initialGithubConnection)
  const [githubRepositories] = useState<GithubRepository[]>(initialGithubRepositories)
  const [githubConnectLoading, setGithubConnectLoading] = useState(false)
  const [githubDisconnectLoading, setGithubDisconnectLoading] = useState(false)
  const [selectedRepo, setSelectedRepo] = useState(
    initialGithubConnection
      ? `${initialGithubConnection.repoOwner}/${initialGithubConnection.repoName}`
      : "",
  )
  const [githubAccountLoading, setGithubAccountLoading] = useState(false)

  const currentRepoLabel = useMemo(() => {
    if (!selectedRepo) return ""
    const repo = githubRepositories.find((r) => r.fullName === selectedRepo)
    return repo?.fullName ?? selectedRepo
  }, [selectedRepo, githubRepositories])

  const showError = useCallback((msg: string) => {
    setSuccess("")
    setError(msg)
  }, [])

  const showSuccess = useCallback((msg: string) => {
    setError("")
    setSuccess(msg)
  }, [])

  async function handleConnectGithubAccount() {
    setGithubAccountLoading(true)
    const { error: err } = await authClient.signIn.social({
      provider: "github",
      callbackURL: `/dashboard/projects/${project.slug}/settings`,
    })
    setGithubAccountLoading(false)
    if (err) showError(err.message ?? "Failed to connect GitHub")
  }

  async function handleConnectRepository() {
    const repository = githubRepositories.find((repo) => repo.fullName === selectedRepo)
    if (!repository) {
      showError("Selected repository not found. Try searching again.")
      return
    }
    setGithubConnectLoading(true)
    setError("")
    setSuccess("")
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
        showError(data.error ?? "Failed to connect repository")
        return
      }
      setGithubConnection(data.connection)
      setSelectedRepo(`${data.connection.repoOwner}/${data.connection.repoName}`)
      showSuccess(`Repository connected successfully`)
    } catch {
      showError("Connection error. Is the collector running?")
    } finally {
      setGithubConnectLoading(false)
    }
  }

  async function handleDisconnectRepository() {
    setGithubDisconnectLoading(true)
    setError("")
    setSuccess("")
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/${project.id}/github`,
        { method: "DELETE", credentials: "include" },
      )
      const data = await res.json()
      if (!res.ok) {
        showError(data.error ?? "Failed to disconnect repository")
        return
      }
      setGithubConnection(null)
      setSelectedRepo("")
      showSuccess("Repository disconnected")
    } catch {
      showError("Connection error. Is the collector running?")
    } finally {
      setGithubDisconnectLoading(false)
    }
  }

  async function handleRotate() {
    setRotating(true)
    setNewToken(null)
    setError("")
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/${project.id}/tokens`,
        { method: "POST", credentials: "include" },
      )
      if (!res.ok) {
        const data = await res.json()
        showError(data.error ?? "Failed to rotate token")
        setRotating(false)
        return
      }
      const data = await res.json()
      setNewToken(data.token)
      const tokensRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/${project.id}/tokens`,
        { credentials: "include" },
      )
      if (tokensRes.ok) {
        const tokensData = await tokensRes.json()
        setTokens(tokensData.tokens ?? [])
      }
    } catch {
      showError("Connection error")
    }
    setRotating(false)
  }

  const hasGithubAccount = githubRepositories.length > 0

  return (
    <div className="mx-auto max-w-2xl">
      {showHeading && (
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/dashboard/projects" className="hover:text-foreground">Projects</Link>
            <span>/</span>
            <Link href={`/dashboard/projects/${project.slug}`} className="hover:text-foreground">{project.name}</Link>
            <span>/</span>
            <span className="text-foreground">Settings</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Project settings</h1>
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} className="font-medium hover:underline">Dismiss</button>
        </div>
      )}

      {success && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-300">
          <span className="flex items-center gap-1.5">
            <Check className="size-4" />
            {success}
          </span>
          <button type="button" onClick={() => setSuccess("")} className="font-medium hover:underline">Dismiss</button>
        </div>
      )}

      {/* Project info */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Details</h2>
        <div className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3 last:border-b-0">
            <span className="text-sm text-muted-foreground">Name</span>
            <span className="text-sm font-medium">{project.name}</span>
          </div>
          <div className="flex items-center justify-between border-b px-4 py-3 last:border-b-0">
            <span className="text-sm text-muted-foreground">Slug</span>
            <span className="text-sm font-mono text-sm font-medium">{project.slug}</span>
          </div>
        </div>
      </section>

      {/* GitHub repository */}
      <section className="mb-8">
        <div className="mb-3">
          <h2 className="text-lg font-semibold">GitHub repository</h2>
        </div>

        {githubConnection ? (
          <div className="rounded-xl border bg-card p-4">
            <div className="mb-4 flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-900/50 dark:bg-green-950/30">
              <FaGithub className="size-5 shrink-0 text-green-700 dark:text-green-400" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-green-800 dark:text-green-300">
                  {githubConnection.repoOwner}/{githubConnection.repoName}
                </p>
                {githubConnection.defaultBranch && (
                  <p className="text-xs text-green-700 dark:text-green-400">
                    <GitBranch className="mr-0.5 inline size-3" />
                    {githubConnection.defaultBranch}
                  </p>
                )}
              </div>
            </div>

            <div className="mb-3">
              <label className="mb-1.5 block text-sm font-medium">Switch repository</label>
              <Combobox value={selectedRepo} onValueChange={(v) => v && setSelectedRepo(v)}>
                <ComboboxInput placeholder="Search repositories..." />
                <ComboboxContent>
                  <ComboboxList>
                    {githubRepositories.map((repo) => (
                      <ComboboxItem key={repo.id} value={repo.fullName}>
                        <FaGithub className="size-4 text-muted-foreground" />
                        {repo.fullName}
                        {repo.isPrivate && (
                          <span className="ml-auto text-[10px] text-muted-foreground">Private</span>
                        )}
                      </ComboboxItem>
                    ))}
                    <ComboboxEmpty>No repositories found</ComboboxEmpty>
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleConnectRepository}
                disabled={githubConnectLoading || !selectedRepo || selectedRepo === currentRepoLabel}
                size="sm"
              >
                {githubConnectLoading ? (
                  <><Loader2 className="mr-1.5 size-3.5 animate-spin" />Saving...</>
                ) : "Save"}
              </Button>
              <Button
                onClick={handleDisconnectRepository}
                disabled={githubDisconnectLoading}
                variant="outline"
                size="sm"
              >
                {githubDisconnectLoading ? (
                  <><Loader2 className="mr-1.5 size-3.5 animate-spin" />Disconnecting...</>
                ) : "Disconnect"}
              </Button>
              <Button
                onClick={handleConnectGithubAccount}
                disabled={githubAccountLoading}
                variant="secondary"
                size="sm"
                className="ml-auto"
              >
                {githubAccountLoading ? (
                  <><Loader2 className="mr-1.5 size-3.5 animate-spin" />Connecting...</>
                ) : "Reconnect GitHub"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed bg-card px-6 py-10 text-center">
            {hasGithubAccount && (
              <div className="mb-1 flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-950/30 dark:text-green-400">
                <Check className="size-3.5" />
                GitHub account connected
              </div>
            )}
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <FaGithub className="size-6 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold">
                {hasGithubAccount ? "No repository connected" : "No GitHub account connected"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {hasGithubAccount
                  ? "Your GitHub account is connected. Select a repository below to link it to this project."
                  : "Link your project to a GitHub repository to enable PR comments and deployment tracking."}
              </p>
            </div>
            {hasGithubAccount ? (
              <div className="w-full max-w-sm space-y-3">
                <Combobox value={selectedRepo} onValueChange={(v) => v && setSelectedRepo(v)}>
                  <ComboboxInput placeholder="Search repositories..." />
                  <ComboboxContent>
                    <ComboboxList>
                      {githubRepositories.map((repo) => (
                        <ComboboxItem key={repo.id} value={repo.fullName}>
                          <FaGithub className="size-4 text-muted-foreground" />
                          {repo.fullName}
                        </ComboboxItem>
                      ))}
                      <ComboboxEmpty>No repositories found</ComboboxEmpty>
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
                <Button
                  onClick={handleConnectRepository}
                  disabled={!selectedRepo || githubConnectLoading}
                  size="sm"
                  className="w-full"
                >
                  {githubConnectLoading ? (
                    <><Loader2 className="mr-1.5 size-3.5 animate-spin" />Connecting...</>
                  ) : (
                    <><Plus className="mr-1.5 size-4" />Connect repository</>
                  )}
                </Button>
              </div>
            ) : (
              <Button onClick={handleConnectGithubAccount} disabled={githubAccountLoading}>
                {githubAccountLoading ? (
                  <><Loader2 className="mr-1.5 size-3.5 animate-spin" />Connecting...</>
                ) : (
                  <><FaGithub className="mr-2 size-4" />Connect GitHub account</>
                )}
              </Button>
            )}
          </div>
        )}
      </section>

      {/* API tokens */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">API tokens</h2>
          <Button onClick={handleRotate} disabled={rotating} variant="outline" size="sm">
            {rotating ? (
              <><Loader2 className="mr-1.5 size-3.5 animate-spin" />Rotating...</>
            ) : "Rotate all tokens"}
          </Button>
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
          <Button variant="outline" size="sm" disabled title="Not yet implemented" className="border-destructive/30 text-destructive hover:bg-destructive/20">
            Delete project
          </Button>
        </div>
      </section>
    </div>
  )
}
