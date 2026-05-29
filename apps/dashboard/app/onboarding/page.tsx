"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { CopyButton } from "@/components/copy-button"
import { ConnectionInstructions } from "@/components/connection-instructions"

interface Tenant {
  id: string
  name: string
  slug: string
}

interface Project {
  id: string
  name: string
  slug: string
  token: string
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<"tenant" | "project" | "done">("tenant")
  const [session, setSession] = useState<{ user: { id: string; name: string; email: string; image?: string | null } } | null>(null)

    // Tenant form
  const [tenantName, setTenantName] = useState("")
  const [tenantSlug, setTenantSlug] = useState("")
  const [tenantLoading, setTenantLoading] = useState(false)
  const [tenantError, setTenantError] = useState("")

  // Project form
  const [, setTenant] = useState<Tenant | null>(null)
  const [projectName, setProjectName] = useState("")
  const [projectSlug, setProjectSlug] = useState("")
  const [projectLoading, setProjectLoading] = useState(false)
  const [projectError, setProjectError] = useState("")

  // Done
  const [project, setProject] = useState<Project | null>(null)

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      if (!data) {
        router.push("/auth/login")
        return
      }
      setSession(data)
    })
  }, [router])

  async function createTenant(e: React.FormEvent) {
    e.preventDefault()
    setTenantError("")
    setTenantLoading(true)

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tenants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: tenantName, slug: tenantSlug }),
      })

      const data = await res.json()

      if (!res.ok) {
        setTenantError(data.error ?? "Failed to create organization")
        setTenantLoading(false)
        return
      }

      setTenant(data.tenant)
      setStep("project")
      setTenantSlug("")
      setTenantName("")
    } catch {
      setTenantError("Connection error. Is the collector running?")
    }

    setTenantLoading(false)
  }

  async function createProject(e: React.FormEvent) {
    e.preventDefault()
    setProjectError("")
    setProjectLoading(true)

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: projectName, slug: projectSlug }),
      })

      const data = await res.json()

      if (!res.ok) {
        setProjectError(data.error ?? "Failed to create project")
        setProjectLoading(false)
        return
      }

      setProject({ ...data.project, token: data.token })
      setStep("done")
    } catch {
      setProjectError("Connection error. Is the collector running?")
    }

    setProjectLoading(false)
  }

  function generateSlug(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
  }

  if (!session) return null

  return (
    <div className="flex min-h-screen items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className={`flex size-8 items-center justify-center rounded-full text-sm font-medium ${step === "tenant" ? "bg-primary text-primary-foreground" : "bg-primary/20 text-primary"}`}>
            {step === "tenant" ? "1" : "✓"}
          </div>
          <div className={`h-px w-12 ${step !== "tenant" ? "bg-primary" : "bg-border"}`} />
          <div className={`flex size-8 items-center justify-center rounded-full text-sm font-medium ${step === "project" ? "bg-primary text-primary-foreground" : step === "done" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
            2
          </div>
          <div className={`h-px w-12 ${step === "done" ? "bg-primary" : "bg-border"}`} />
          <div className={`flex size-8 items-center justify-center rounded-full text-sm font-medium ${step === "done" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            3
          </div>
        </div>

        {step === "tenant" && (
          <div className="flex flex-col gap-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold tracking-tight">Create your organization</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                This will be your workspace for managing projects
              </p>
            </div>

            <form onSubmit={createTenant} className="flex flex-col gap-4">
              {tenantError && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {tenantError}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label htmlFor="org-name" className="text-sm font-medium">Organization name</label>
                <input
                  id="org-name"
                  type="text"
                  required
                  value={tenantName}
                  onChange={(e) => {
                    setTenantName(e.target.value)
                    if (!tenantSlug || tenantSlug === generateSlug(tenantSlug)) {
                      setTenantSlug(generateSlug(e.target.value))
                    }
                  }}
                  className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  placeholder="Acme Inc"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="org-slug" className="text-sm font-medium">URL slug</label>
                <div className="flex items-center gap-1 rounded-lg border border-input bg-background px-3 py-2 text-sm">
                  <span className="text-muted-foreground">app.nextdoctor.dev/</span>
                  <input
                    id="org-slug"
                    type="text"
                    required
                    pattern="^[a-z0-9-]+$"
                    value={tenantSlug}
                    onChange={(e) => setTenantSlug(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent outline-none"
                    placeholder="acme-inc"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={tenantLoading}
                className="mt-2 inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
              >
                {tenantLoading ? "Creating..." : "Create organization"}
              </button>
            </form>
          </div>
        )}

        {step === "project" && (
          <div className="flex flex-col gap-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold tracking-tight">Create your first project</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                A project represents one Next.js application
              </p>
            </div>

            <form onSubmit={createProject} className="flex flex-col gap-4">
              {projectError && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {projectError}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label htmlFor="project-name" className="text-sm font-medium">Project name</label>
                <input
                  id="project-name"
                  type="text"
                  required
                  value={projectName}
                  onChange={(e) => {
                    setProjectName(e.target.value)
                    if (!projectSlug || projectSlug === generateSlug(projectSlug)) {
                      setProjectSlug(generateSlug(e.target.value))
                    }
                  }}
                  className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  placeholder="My Next.js App"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="project-slug" className="text-sm font-medium">Slug</label>
                <input
                  id="project-slug"
                  type="text"
                  required
                  pattern="^[a-z0-9-]+$"
                  value={projectSlug}
                  onChange={(e) => setProjectSlug(e.target.value)}
                  className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  placeholder="my-next-app"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep("tenant")}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-input bg-background px-4 text-sm font-medium transition-all hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={projectLoading}
                  className="inline-flex h-9 flex-1 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
                >
                  {projectLoading ? "Creating..." : "Create project"}
                </button>
              </div>
            </form>
          </div>
        )}

        {step === "done" && project && (
          <div className="flex flex-col gap-6 text-center">
            <div className="flex flex-col gap-2">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h1 className="text-2xl font-bold tracking-tight">All set!</h1>
              <p className="text-sm text-muted-foreground">
                Your project <strong>{project.name}</strong> is ready.
              </p>
            </div>

            <ConnectionInstructions token={project.token} />

            <button
              type="button"
              onClick={() => router.push(`/projects/${project.slug}`)}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Go to project
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
