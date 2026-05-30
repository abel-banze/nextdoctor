import Link from "next/link"
import { BookOpen, Terminal, Rocket, Cog, Code2, Hexagon, Cpu, ShieldCheck, Wrench, GitBranch, Sliders } from "lucide-react"

const toc = [
  { href: "#overview", label: "Overview", icon: BookOpen },
  { href: "#installation", label: "Installation", icon: Terminal },
  { href: "#quick-start", label: "Quick start", icon: Rocket },
  { href: "#advanced-setup", label: "Advanced setup", icon: Cog },
  { href: "#api-reference", label: "API reference", icon: Code2 },
  { href: "#middleware", label: "Middleware", icon: GitBranch },
  { href: "#system-monitoring", label: "System monitoring", icon: Cpu },
  { href: "#detection-engine", label: "Detection engine", icon: Hexagon },
  { href: "#cli", label: "CLI commands", icon: Terminal },
  { href: "#environment-variables", label: "Environment variables", icon: Sliders },
  { href: "#best-practices", label: "Best practices", icon: ShieldCheck },
  { href: "#troubleshooting", label: "Troubleshooting", icon: Wrench },
]

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-8">
      <div className="min-w-0 flex-1">{children}</div>

      <aside className="hidden w-56 shrink-0 lg:block">
        <div className="sticky top-6 space-y-1">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            On this page
          </p>
          {toc.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Icon className="size-3.5 shrink-0" />
              {label}
            </Link>
          ))}
        </div>
      </aside>
    </div>
  )
}
