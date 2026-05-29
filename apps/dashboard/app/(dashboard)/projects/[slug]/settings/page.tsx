"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CopyButton } from "@/components/copy-button"

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
          <Link href="/projects" className="hover:text-foreground">Projects</Link>
          <span>/</span>
          <Link href={`/projects/${slug}`} className="hover:text-foreground">{project?.name}</Link>
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
