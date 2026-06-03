import Link from "next/link"
import { redirect } from "next/navigation"
import { serverFetch } from "@/lib/server-api"

interface Project {
  id: string
  name: string
  slug: string
}

interface User {
  id: string
  name: string
  email: string
}

interface Tenant {
  id: string
  name: string
  slug: string
}

interface MeResponse {
  tenant: Tenant | null
  subscription: { id: string; plan: string } | null
  user: User | null
}

export default async function DashboardHome() {
  const { data: me } = await serverFetch<MeResponse>("/tenants/me")

  if (!me?.tenant) {
    redirect("/onboarding")
  }

  const { data: projects } = await serverFetch<Project[]>("/projects")

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome{me.user?.name ? `, ${me.user.name}` : ""}
        </h1>
        <p className="mt-1 text-muted-foreground">
          NextDoctor monitors your Next.js apps, catches errors, and helps you fix them — before your users notice.
        </p>
      </div>

      {projects && projects.length > 0 ? (
        <section>
          <h2 className="mb-4 text-lg font-semibold">Your Projects</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/dashboard/projects/${project.slug}`}
                className="group rounded-lg border p-4 transition-colors hover:bg-accent"
              >
                <h3 className="font-medium group-hover:text-primary">{project.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{project.slug}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <section className="rounded-lg border bg-muted/30 p-6">
          <h2 className="text-lg font-semibold">Get Started</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first project and install the NextDoctor agent to start monitoring.
          </p>
          <div className="mt-4">
            <Link
              href="/dashboard/projects/new"
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              New Project
            </Link>
          </div>
        </section>
      )}

      <section className="rounded-lg border p-6">
        <h2 className="text-lg font-semibold">Quick Links</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/dashboard/projects/new"
            className="rounded-md border p-4 transition-colors hover:bg-accent"
          >
            <div className="font-medium">Create Project</div>
            <p className="mt-1 text-sm text-muted-foreground">Add a new project to your dashboard</p>
          </Link>
          <a
            href="https://nextdoctor.dev/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border p-4 transition-colors hover:bg-accent"
          >
            <div className="font-medium">Documentation</div>
            <p className="mt-1 text-sm text-muted-foreground">Learn how to install and configure the agent</p>
          </a>
          <a
            href="https://github.com/abel-banze/nextdoctor"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border p-4 transition-colors hover:bg-accent"
          >
            <div className="font-medium">GitHub</div>
            <p className="mt-1 text-sm text-muted-foreground">Source code, issues, and contributions</p>
          </a>
          <a
            href="https://nextdoctor.dev/support"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border p-4 transition-colors hover:bg-accent"
          >
            <div className="font-medium">Support</div>
            <p className="mt-1 text-sm text-muted-foreground">Get help from the team</p>
          </a>
        </div>
      </section>
    </div>
  )
}
