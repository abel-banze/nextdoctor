import Link from "next/link"
import { redirect } from "next/navigation"
import { serverFetch } from "@/lib/server-api"
import { ProjectSettingsClient } from "./_components/project-settings-client"

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

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const { data: projects } = await serverFetch<Project[]>("/projects")
  if (!projects) redirect("/auth/login")

  const project = projects.find((p) => p.slug === slug)
  if (!project) {
    return (
      <div className="mx-auto max-w-4xl py-10">
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Project not found
        </div>
      </div>
    )
  }

  const [tokensData, githubData, reposData] = await Promise.all([
    serverFetch<{ tokens: Token[] }>(`/projects/${project.id}/tokens`),
    serverFetch<{ connection: GithubConnection | null }>(`/projects/${project.id}/github`),
    serverFetch<{ repositories: GithubRepository[] }>(`/projects/${project.id}/github/repos`),
  ])

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/dashboard/projects" className="hover:text-foreground">Projects</Link>
          <span>/</span>
          <span className="text-foreground">{project.name}</span>
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{project.name}</h1>
      </div>

      {/* Project tabs */}
      <div className="mb-6 flex items-center gap-0 border-b">
        <Link
          href={`/dashboard/analytics?projectId=${project.id}`}
          className="-mb-px border-b-2 border-transparent px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground"
        >
          Dashboard
        </Link>
        <Link
          href={`/dashboard/projects/${slug}`}
          className="-mb-px border-b-2 border-transparent px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground"
        >
          Issues
        </Link>
        <Link
          href={`/dashboard/projects/${slug}/settings`}
          className="-mb-px border-b-2 border-foreground px-4 py-3 text-sm font-medium text-foreground"
        >
          Settings
        </Link>
      </div>

      <ProjectSettingsClient
        project={project}
        initialTokens={tokensData.data?.tokens ?? []}
        initialGithubConnection={githubData.data?.connection ?? null}
        initialGithubRepositories={reposData.data?.repositories ?? []}
        showHeading={false}
      />
    </div>
  )
}
