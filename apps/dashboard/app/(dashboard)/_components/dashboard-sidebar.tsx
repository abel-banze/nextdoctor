"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  FolderKanban,
  Plus,
  LogOut,
  ChevronDown,
  ChevronRight,
  Hexagon,
} from "lucide-react"
import { authClient } from "@/lib/auth-client"

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

const planColors: Record<string, string> = {
  free: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  pro: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  team: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  enterprise: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
}

export function DashboardSidebar({
  user,
  tenant,
  subscription,
  projects,
}: {
  user: User
  tenant: Tenant | null
  subscription: Subscription | null
  projects: Project[]
}) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [projectsOpen, setProjectsOpen] = useState(
    pathname.startsWith("/projects")
  )

  const isActive = (href: string) => pathname === href

  const branding = (
    <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
      <div className="flex size-6 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
        ND
      </div>
      NextDoctor
    </Link>
  )

  const tenantInfo = tenant && (
    <div className="flex items-center gap-2">
      <div className="flex size-6 items-center justify-center rounded bg-muted text-[10px] font-semibold text-muted-foreground">
        {tenant.name.charAt(0).toUpperCase()}
      </div>
      <span className="truncate text-xs font-medium text-muted-foreground">
        {tenant.name}
      </span>
    </div>
  )

  const navLinks = (onClickLink?: () => void) => (
    <>
      <Link
        href="/"
        onClick={onClickLink}
        data-active={isActive("/") || undefined}
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active]:bg-sidebar-accent data-[active]:text-sidebar-accent-foreground"
      >
        <LayoutDashboard className="size-4 shrink-0" />
        Home
      </Link>

      <div>
        <button
          type="button"
          onClick={() => setProjectsOpen(!projectsOpen)}
          data-active={isActive("/projects") || undefined}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active]:bg-sidebar-accent data-[active]:text-sidebar-accent-foreground"
        >
          <FolderKanban className="size-4 shrink-0" />
          <span className="flex-1 text-left">Projects</span>
          {projectsOpen ? (
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
          )}
        </button>

        {projectsOpen && projects.length > 0 && (
          <div className="ml-2 mt-0.5 flex flex-col gap-0.5 border-l pl-2">
            {projects.map((project) => {
              const projectHref = `/projects/${project.slug}`
              const active = pathname === projectHref || pathname.startsWith(`${projectHref}/`)
              return (
                <Link
                  key={project.id}
                  href={projectHref}
                  onClick={onClickLink}
                  data-active={active || undefined}
                  className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active]:bg-sidebar-accent data-[active]:text-sidebar-accent-foreground"
                >
                  <Hexagon className="size-3 shrink-0 text-muted-foreground" />
                  <span className="truncate">{project.name}</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      <Link
        href="/projects/new"
        onClick={onClickLink}
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <Plus className="size-4 shrink-0" />
        New Project
      </Link>
    </>
  )

  const planBadge = subscription && (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${planColors[subscription.plan] ?? planColors.free}`}
    >
      {subscription.plan} Plan
    </span>
  )

  const userSection = (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2">
      <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
        {user.name?.charAt(0).toUpperCase() ?? "U"}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{user.name}</span>
        <span className="truncate text-xs text-muted-foreground">{user.email}</span>
      </div>
    </div>
  )

  const signOutButton = (
    <button
      type="button"
      onClick={async () => {
        await authClient.signOut()
        window.location.href = "/auth/login"
      }}
      className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
    >
      <LogOut className="size-4 shrink-0" />
      Sign out
    </button>
  )

  return (
    <>
      {/* Desktop */}
      <aside className="hidden w-56 flex-col border-r bg-sidebar md:flex">
        <div className="flex h-14 items-center border-b px-4">
          {branding}
        </div>
        {tenant && <div className="border-b px-4 py-2">{tenantInfo}</div>}
        <nav className="flex-1 overflow-y-auto p-3">
          <div className="flex flex-col gap-1">
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Main
            </p>
            {navLinks()}
          </div>
        </nav>
        <div className="border-t p-3">
          {subscription && <div className="mb-2 px-3 pb-2">{planBadge}</div>}
          {userSection}
          {signOutButton}
        </div>
      </aside>

      {/* Mobile header */}
      <header className="flex h-14 items-center gap-4 border-b px-4 md:hidden">
        <button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle menu"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        {branding}
      </header>

      {/* Mobile overlay sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed inset-y-0 left-0 w-56 border-r bg-sidebar">
            <div className="flex h-14 items-center border-b px-4">
              {branding}
            </div>
            {tenant && <div className="border-b px-4 py-2">{tenantInfo}</div>}
            <nav className="overflow-y-auto p-3">
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Main
              </p>
              {navLinks(() => setSidebarOpen(false))}
            </nav>
            <div className="border-t p-3">
              {subscription && <div className="mb-2 px-3 pb-2">{planBadge}</div>}
              {userSection}
              {signOutButton}
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
