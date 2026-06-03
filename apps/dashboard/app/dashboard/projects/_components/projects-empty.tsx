import Link from "next/link"

export function ProjectsEmpty() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border bg-card p-12 text-center">
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></svg>
      <div>
        <h3 className="font-semibold">No projects yet</h3>
        <p className="text-sm text-muted-foreground">Create your first project to start monitoring.</p>
      </div>
      <Link
        href="/dashboard/projects/new"
        className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80"
      >
        Create project
      </Link>
    </div>
  )
}
