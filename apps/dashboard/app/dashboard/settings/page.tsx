import { redirect } from "next/navigation"
import { serverFetch } from "@/lib/server-api"

interface MeResponse {
  tenant: { id: string; name: string; slug: string } | null
  subscription: { id: string; plan: string; status: string } | null
  user: { id: string; name: string; email: string; image?: string | null } | null
}

export default async function SettingsPage() {
  const { data, error } = await serverFetch<MeResponse>("/tenants/me")

  if (error === "Unauthorized" || !data?.user) {
    redirect("/auth/login")
  }

  const { user, tenant, subscription } = data

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account and preferences</p>
      </div>

      {/* Profile */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Profile</h2>
        <div className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3 last:border-b-0">
            <span className="text-sm text-muted-foreground">Name</span>
            <span className="text-sm font-medium">{user.name}</span>
          </div>
          <div className="flex items-center justify-between border-b px-4 py-3 last:border-b-0">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm font-medium">{user.email}</span>
          </div>
        </div>
      </section>

      {/* Organization */}
      {tenant && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Organization</h2>
          <div className="rounded-xl border bg-card">
            <div className="flex items-center justify-between border-b px-4 py-3 last:border-b-0">
              <span className="text-sm text-muted-foreground">Name</span>
              <span className="text-sm font-medium">{tenant.name}</span>
            </div>
            <div className="flex items-center justify-between border-b px-4 py-3 last:border-b-0">
              <span className="text-sm text-muted-foreground">Slug</span>
              <span className="text-sm font-medium">{tenant.slug}</span>
            </div>
          </div>
        </section>
      )}

      {/* Plan */}
      {subscription && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Plan</h2>
          <div className="rounded-xl border bg-card">
            <div className="flex items-center justify-between border-b px-4 py-3 last:border-b-0">
              <span className="text-sm text-muted-foreground">Current plan</span>
              <span className="text-sm font-medium capitalize">{subscription.plan}</span>
            </div>
            <div className="flex items-center justify-between border-b px-4 py-3 last:border-b-0">
              <span className="text-sm text-muted-foreground">Status</span>
              <span className="text-sm font-medium capitalize">{subscription.status}</span>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
