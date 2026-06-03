"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { CopyButton } from "@/components/copy-button"
import { ConnectionInstructions } from "@/components/connection-instructions"

export default function NewProjectPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [createdToken, setCreatedToken] = useState<string | null>(null)

  function generateSlug(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, slug }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? "Failed to create project")
        setLoading(false)
        return
      }

      setCreatedToken(data.token)
    } catch {
      setError("Connection error. Is the collector running?")
    }

    setLoading(false)
  }

  if (createdToken) {
    return (
      <div className="mx-auto max-w-lg py-10">
        <div className="flex flex-col gap-6 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Project created</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Save this token — you won&apos;t see it again.
            </p>
          </div>

          <div className="rounded-lg border bg-card p-4 text-left">
            <p className="mb-2 text-sm font-medium">API token</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-hidden text-ellipsis rounded-md bg-muted px-3 py-2 text-sm font-mono">
                {createdToken}
              </code>
              <CopyButton value={createdToken!} label="Token copied" />
            </div>
          </div>

          <ConnectionInstructions token={createdToken!} />

          <button
            type="button"
            onClick={() => router.push(`/dashboard/projects/${slug}`)}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80"
          >
            Go to project
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg py-10">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/dashboard/projects" className="hover:text-foreground">Projects</Link>
          <span>/</span>
          <span className="text-foreground">New</span>
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Create project</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label htmlFor="name" className="text-sm font-medium">Project name</label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (!slug || slug === generateSlug(slug)) {
                setSlug(generateSlug(e.target.value))
              }
            }}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            placeholder="My Next.js App"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="slug" className="text-sm font-medium">Slug</label>
          <input
            id="slug"
            type="text"
            required
            pattern="^[a-z0-9-]+$"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            placeholder="my-next-app"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create project"}
        </button>
      </form>
    </div>
  )
}
