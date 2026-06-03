import { redirect } from "next/navigation"
import { serverFetch } from "@/lib/server-api"
import { DashboardSidebar } from "./_components/dashboard-sidebar"
import { DashboardHeader } from "./_components/dashboard-header"

interface User {
  id: string
  name: string
  email: string
  image?: string | null
}

interface Tenant {
  id: string
  name: string
  slug: string
}

interface Subscription {
  id: string
  plan: string
  status: string
}

interface Project {
  id: string
  name: string
  slug: string
}

interface MeResponse {
  tenant: Tenant | null
  subscription: Subscription | null
  user: User | null
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data, error } = await serverFetch<MeResponse>("/tenants/me")

  if (error === "Unauthorized" || !data?.user) {
    redirect("/auth/login")
  }

  const { user, tenant, subscription } = data

  const { data: projects } = await serverFetch<Project[]>("/projects")

  return (
    <div className="flex h-screen">
      <DashboardSidebar user={user} tenant={tenant} subscription={subscription} projects={projects ?? []} />
      <div className="flex flex-1 flex-col overflow-hidden md:ml-56">
        <DashboardHeader user={user} projects={projects ?? []} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
