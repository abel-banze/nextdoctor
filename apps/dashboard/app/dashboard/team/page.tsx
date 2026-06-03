import { redirect } from "next/navigation"
import { serverFetch } from "@/lib/server-api"

interface MeResponse {
  tenant: { id: string; name: string; slug: string } | null
  user: { id: string; name: string; email: string } | null
}

interface Member {
  id: string
  name: string
  email: string
  role: string
}

interface MembersResponse {
  members: Member[]
}

export default async function TeamPage() {
  const { data: me, error } = await serverFetch<MeResponse>("/tenants/me")

  if (error === "Unauthorized" || !me?.user) {
    redirect("/auth/login")
  }

  const { data: membersData } = await serverFetch<MembersResponse>("/members")

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground">Manage your team members</p>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Members</h2>
        {!membersData || membersData.members.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-12 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <div>
              <h3 className="font-semibold">No members yet</h3>
              <p className="text-sm text-muted-foreground">Invite your team to collaborate.</p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border bg-card">
            {membersData.members.map((member) => (
              <div key={member.id} className="flex items-center justify-between border-b px-4 py-3 last:border-b-0">
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize">
                  {member.role}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
