"use client"

import { useState, useRef, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { useTheme } from "next-themes"
import {
  ChevronDown,
  ChevronUp,
  Check,
  Sun,
  Moon,
  Bell,
  LogOut,
  User,
  Hexagon,
  Search,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { authClient } from "@/lib/auth-client"

interface UserData {
  id: string
  name: string
  email: string
  image?: string | null
}

interface Project {
  id: string
  name: string
  slug: string
}

export function DashboardHeader({
  user,
  projects,
}: {
  user: UserData
  projects: Project[]
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { setTheme, resolvedTheme } = useTheme()

  const [mounted, setMounted] = useState(false)
  const [projectOpen, setProjectOpen] = useState(false)
  const [projectSearch, setProjectSearch] = useState("")
  const [userOpen, setUserOpen] = useState(false)

  const projectRef = useRef<HTMLDivElement>(null)
  const userRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const currentProjectSlug = pathname.match(/^\/dashboard\/projects\/([^/]+)/)?.[1]

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (projectRef.current && !projectRef.current.contains(e.target as Node)) {
        setProjectOpen(false)
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setUserOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const currentProject = projects.find((p) => p.slug === currentProjectSlug)

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(projectSearch.toLowerCase()),
  )

  function handleProjectSelect(slug: string) {
    setProjectOpen(false)
    setProjectSearch("")
    router.push(`/dashboard/projects/${slug}`)
  }

  async function handleSignOut() {
    await authClient.signOut()
    window.location.href = "/auth/login"
  }

  function toggleTheme() {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }

  const isDark = resolvedTheme === "dark"

  function toggleMobileSidebar() {
    window.dispatchEvent(new CustomEvent("toggle-sidebar"))
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 md:px-6">
      {/* Mobile menu toggle */}
      <button
        type="button"
        onClick={toggleMobileSidebar}
        className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent md:hidden"
        aria-label="Toggle menu"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>

      {/* Project switcher */}
      <div className="relative" ref={projectRef}>
        <button
          type="button"
          onClick={() => setProjectOpen(!projectOpen)}
          className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
        >
          <Hexagon className="size-4 shrink-0 text-muted-foreground" />
          <span className="max-w-[160px] truncate">
            {currentProject?.name ?? "Select project"}
          </span>
          {projectOpen ? (
            <ChevronUp className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          )}
        </button>

        {projectOpen && (
          <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border bg-popover text-popover-foreground shadow-lg">
            <div className="flex items gap-2 border-b px-3 py-2">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                type="text"
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                placeholder="Search projects..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                autoFocus
              />
            </div>

            <div className="max-h-60 overflow-y-auto p-1">
              {filteredProjects.length === 0 ? (
                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                  {projects.length === 0
                    ? "No projects yet"
                    : "No projects found"}
                </div>
              ) : (
                filteredProjects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => handleProjectSelect(project.slug)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent",
                      project.slug === currentProjectSlug && "bg-accent font-medium",
                    )}
                  >
                    <Hexagon className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate text-left">{project.name}</span>
                    {project.slug === currentProjectSlug && (
                      <Check className="size-3.5 shrink-0 text-primary" />
                    )}
                  </button>
                ))
              )}
            </div>

            <div className="border-t p-1">
              <Link
                href="/dashboard/projects/new"
                onClick={() => setProjectOpen(false)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent"
              >
                <span className="text-lg leading-none">+</span>
                New project
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Theme toggle */}
      <button
        type="button"
        onClick={toggleTheme}
        className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent"
        aria-label="Toggle theme"
      >
        {mounted && (isDark ? <Sun className="size-4" /> : <Moon className="size-4" />)}
      </button>

      {/* Notifications */}
      <button
        type="button"
        className="relative flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent"
        aria-label="Notifications"
      >
        <Bell className="size-4" />
        <span className="absolute right-1.5 top-1.5 flex size-2 rounded-full bg-primary" />
      </button>

      {/* User dropdown */}
      <div className="relative" ref={userRef}>
        <button
          type="button"
          onClick={() => setUserOpen(!userOpen)}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent"
        >
          <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
            {user.name?.charAt(0).toUpperCase() ?? "U"}
          </div>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        </button>

        {userOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border bg-popover text-popover-foreground shadow-lg">
            <div className="border-b px-3 py-2.5">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>

            <div className="p-1">
              <Link
                href="/dashboard/settings"
                onClick={() => setUserOpen(false)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
              >
                <User className="size-4" />
                Settings
              </Link>
            </div>

            <div className="border-t p-1">
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
