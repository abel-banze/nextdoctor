import Link from "next/link"
import { serverFetch } from "@/lib/server-api"
import { ProjectsEmpty } from "./_components/projects-empty"

interface Project {
  id: string
  name: string
  slug: string
  environment: string
  isActive: boolean
  createdAt: string
}

export default async function ProjectsPage() {
  const { data: projects, error } = await serverFetch<Project[]>("/projects")

  if (error) {
    return (
      <div className="mx-auto max-w-4xl py-10">
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">Manage your Next.js applications</p>
        </div>
        <Link
          href="/projects/new"
          className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80"
        >
          New project
        </Link>
      </div>

      {!projects || projects.length === 0 ? (
        <ProjectsEmpty />
      ) : (
        <div className="grid gap-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.slug}`}
              className="flex items-center gap-4 rounded-xl border bg-card p-4 transition-colors hover:bg-accent/50"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5"/></svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">{project.name}</h3>
                <p className="text-xs text-muted-foreground truncate">
                  {project.environment} · Created {new Date(project.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${project.isActive ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                {project.isActive ? "Active" : "Inactive"}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
