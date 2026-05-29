import { redirect } from "next/navigation"
import { serverFetch } from "@/lib/server-api"

interface Project {
  id: string
  slug: string
}

export default async function DashboardHome() {
  const { data: tenantData } = await serverFetch<{ tenant: { id: string } | null }>("/tenants/me")

  if (!tenantData?.tenant) {
    redirect("/onboarding")
  }

  const { data: projects } = await serverFetch<Project[]>("/projects")

  if (projects && projects.length > 0) {
    redirect(`/projects/${projects[0].slug}`)
  }

  redirect("/onboarding")
}
