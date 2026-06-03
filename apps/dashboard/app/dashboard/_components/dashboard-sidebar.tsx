"use client"

import { useState, useEffect, useRef } from "react"
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
  BookOpen,
  BarChart3,
  Settings,
  Users,
  Activity,
  CheckCircle2,
} from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

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
  const [userOpen, setUserOpen] = useState(false)
  const userRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onToggle(e: CustomEvent) {
      setSidebarOpen(e.detail ?? ((prev: boolean) => !prev))
    }
    window.addEventListener("toggle-sidebar" as any, onToggle as any)
    return () => window.removeEventListener("toggle-sidebar" as any, onToggle as any)
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setUserOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const [projectsOpen, setProjectsOpen] = useState(
    pathname.startsWith("/dashboard/projects"),
  )

  const isActive = (href: string) => pathname === href
  const activeProjects = projects.filter(() => true).length

  const linkClass = "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
  const linkActive = "bg-sidebar-accent text-sidebar-accent-foreground"
  const linkInactive = "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"

  function NavLink({
    href,
    icon: Icon,
    label,
    onClick,
  }: {
    href: string
    icon: React.ComponentType<{ className?: string }>
    label: string
    onClick?: () => void
  }) {
    const active = isActive(href)
    return (
      <Link
        href={href}
        onClick={onClick}
        className={cn(linkClass, active ? linkActive : linkInactive)}
      >
        <Icon className="size-4 shrink-0" />
        {label}
      </Link>
    )
  }

  const sidebar = (onNavLinkClick?: () => void) => (
    <>
      {/* Branding */}
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/dashboard" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            ND
          </div>
          NextDoctor
        </Link>
      </div>

      {/* Tenant */}
      {tenant && (
        <div className="border-b px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded bg-muted text-[10px] font-semibold text-muted-foreground">
              {tenant.name.charAt(0).toUpperCase()}
            </div>
            <span className="truncate text-xs font-medium text-muted-foreground">
              {tenant.name}
            </span>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3">
        <div className="flex flex-col gap-4">
          {/* Main */}
          <div>
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Main
            </p>
            <div className="flex flex-col gap-0.5">
              <NavLink href="/dashboard" icon={LayoutDashboard} label="Home" onClick={onNavLinkClick} />
              <NavLink href="/dashboard/analytics" icon={BarChart3} label="Analytics" onClick={onNavLinkClick} />
            </div>
          </div>

          {/* Workspace */}
          <div>
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Workspace
            </p>
            <div className="flex flex-col gap-0.5">
              <div>
                <button
                  type="button"
                  onClick={() => setProjectsOpen(!projectsOpen)}
                  data-active={isActive("/dashboard/projects") || undefined}
                  className={cn(linkClass, "w-full", isActive("/dashboard/projects") ? linkActive : linkInactive)}
                >
                  <FolderKanban className="size-4 shrink-0" />
                  <span className="flex-1 text-left">Projects</span>
                  {projectsOpen ? (
                    <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                  )}
                </button>

                {projectsOpen && (
                  <div className="ml-2 mt-0.5 flex flex-col gap-0.5 border-l pl-2">
                    {projects.length === 0 ? (
                      <p className="px-3 py-1.5 text-xs text-muted-foreground">No projects</p>
                    ) : (
                      projects.map((project) => {
                        const projectHref = `/dashboard/projects/${project.slug}`
                        const active = pathname === projectHref || pathname.startsWith(`${projectHref}/`)
                        return (
                          <Link
                            key={project.id}
                            href={projectHref}
                            onClick={onNavLinkClick}
                            data-active={active || undefined}
                            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active]:bg-sidebar-accent data-[active]:text-sidebar-accent-foreground"
                          >
                            <Hexagon className="size-3 shrink-0 text-muted-foreground" />
                            <span className="truncate">{project.name}</span>
                          </Link>
                        )
                      })
                    )}
                    <Link
                      href="/dashboard/projects/new"
                      onClick={onNavLinkClick}
                      className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent"
                    >
                      <Plus className="size-3 shrink-0" />
                      New project
                    </Link>
                  </div>
                )}
              </div>

              <NavLink href="/dashboard/team" icon={Users} label="Team" onClick={onNavLinkClick} />
            </div>
          </div>

          {/* Resources */}
          <div>
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Resources
            </p>
            <div className="flex flex-col gap-0.5">
              <NavLink href="/dashboard/docs" icon={BookOpen} label="Docs" onClick={onNavLinkClick} />
            </div>
          </div>
        </div>
      </nav>

      {/* Health stats */}
      <div className="mx-3 mb-1 rounded-lg border bg-card p-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-4 text-green-500" />
          <span className="text-xs font-medium">All systems operational</span>
        </div>
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Activity className="size-3" />
            <span>{activeProjects} project{activeProjects !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>

      {/* Bottom: User dropdown */}
      <div className="border-t p-3">
        {/* User dropdown */}
        <div className="relative" ref={userRef}>
          <button
            type="button"
            onClick={() => setUserOpen(!userOpen)}
            className="flex w-full items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-sidebar-accent"
          >
            <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
              {user.name?.charAt(0).toUpperCase() ?? "U"}
            </div>
            <div className="flex min-w-0 flex-1 flex-col text-left">
              <span className="truncate text-sm font-medium text-sidebar-foreground">{user.name}</span>
              <span className="truncate text-xs text-muted-foreground">{user.email}</span>
            </div>
            <ChevronDown className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", userOpen && "rotate-180")} />
          </button>

          {userOpen && (
            <div className="absolute bottom-full left-0 right-0 z-50 mb-1 rounded-lg border bg-popover text-popover-foreground shadow-lg">
              <div className="p-1">
                {subscription && (
                  <div className="px-2 pb-1.5">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${planColors[subscription.plan] ?? planColors.free}`}
                    >
                      {subscription.plan} Plan
                    </span>
                  </div>
                )}
                <Link
                  href="/dashboard/settings"
                  onClick={() => { setUserOpen(false); onNavLinkClick?.() }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
                >
                  <Settings className="size-4" />
                  Settings
                </Link>
                <button
                  type="button"
                  onClick={async () => {
                    await authClient.signOut()
                    window.location.href = "/auth/login"
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <LogOut className="size-4" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-56 flex-col border-r bg-sidebar md:flex">
        {sidebar()}
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed inset-y-0 left-0 w-56 border-r bg-sidebar">
            {sidebar(() => setSidebarOpen(false))}
          </aside>
        </div>
      )}
    </>
  )
}
