import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const detectionRules = [
  {
    id: "FETCH_NO_CACHE",
    label: "Missing cache",
    description:
      "Detects fetch() calls without a cache option inside Server Components and calculates the latency cost per request.",
    example: "→ +380ms per request. Add { next: { revalidate: 3600 } }",
  },
  {
    id: "DYNAMIC_ROUTE_CANDIDATE",
    label: "Unnecessary dynamic route",
    description:
      "Identifies routes forced into dynamic mode by cookies() or headers() even when no value is actually read.",
    example: "→ Could be static. Remove cookies() or move it to a Server Action.",
  },
  {
    id: "COLD_START_THRESHOLD",
    label: "Slow cold start",
    description:
      "Alerts when Edge Runtime functions exceed 800ms cold start and explains what is causing it.",
    example: "→ 1240ms detected. Move heavy imports outside the handler.",
  },
];

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "",
    features: ["5 routes", "10k req/month", "3 detection rules"],
    cta: "Get started",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$19",
    period: "/mo",
    features: [
      "Unlimited routes",
      "AI Doctor",
      "90-day history",
      "Self-host support",
    ],
    cta: "Start for free",
    highlight: true,
  },
  {
    name: "Team",
    price: "$49",
    period: "/mo",
    features: [
      "Up to 10 developers",
      "SSO",
      "PDF reports",
      "Priority support",
    ],
    cta: "Contact us",
    highlight: false,
  },
];

const stackItems = [
  { tech: "OpenTelemetry", role: "Trace collection" },
  { tech: "Hono", role: "Ingest API" },
  { tech: "PostgreSQL + Drizzle", role: "Storage" },
  { tech: "Next.js 15", role: "Dashboard" },
  { tech: "Better Auth", role: "Authentication" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold tracking-tight">
              NextDoctor
            </span>
            <Badge variant="secondary" className="text-xs font-medium">
              Beta
            </Badge>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <Link href="#how-it-works" className="hover:text-foreground transition-colors">
              How it works
            </Link>
            <Link href="#diagnostics" className="hover:text-foreground transition-colors">
              Diagnostics
            </Link>
            <Link href="#pricing" className="hover:text-foreground transition-colors">
              Pricing
            </Link>
            <Link href="#docs" className="hover:text-foreground transition-colors">
              Docs
            </Link>
          </nav>
          <Link href="/auth/login">
            <Button size="sm">Login</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-24 pt-20">
        <div className="max-w-3xl">
          <Badge variant="outline" className="mb-6 text-xs">
            🚧 Public beta — feedback welcome
          </Badge>
          <h1 className="mb-6 text-5xl font-semibold leading-[1.1] tracking-tight md:text-6xl">
            Debug your Next.js app{" "}
            <span className="text-muted-foreground">in production.</span>
          </h1>
          <p className="mb-10 max-w-xl text-lg text-muted-foreground leading-relaxed">
            NextDoctor detects App Router anti-patterns, explains the problem in
            plain language, and gives you a copy-paste fix. No configuration.
            No noise.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" className="font-medium">
              Get started with npx
            </Button>
            <Button size="lg" variant="outline">
              View demo
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            <code className="rounded bg-muted px-2 py-1 text-xs">
              npx @codebaz/nextdoctor init
            </code>{" "}
            — zero dependencies added to your bundle
          </p>
        </div>
      </section>

      <Separator />

      {/* How it works */}
      <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-12">
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            How it works
          </p>
          <h2 className="text-3xl font-semibold tracking-tight">
            From trace to fix in seconds
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-0 md:grid-cols-4">
          {[
            {
              step: "01",
              title: "Install the agent",
              body: "One command scaffolds the agent via the Next.js Instrumentation Hook.",
            },
            {
              step: "02",
              title: "Agent captures traces",
              body: "@codebaz/nextdoctor-agent collects OTel spans with native Next.js context.",
            },
            {
              step: "03",
              title: "Analysis engine",
              body: "The collector matches patterns and generates diagnoses with per-route context.",
            },
            {
              step: "04",
              title: "Fix ready to copy",
              body: "The dashboard shows the problem, the cause, and the fix snippet. No guesswork.",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="relative border-b border-border/40 p-6 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0"
            >
              <p className="mb-4 text-4xl font-light text-muted-foreground/30">
                {item.step}
              </p>
              <h3 className="mb-2 text-sm font-medium">{item.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <Separator />

      {/* Detection rules */}
      <section id="diagnostics" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-12">
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            MVP diagnostics
          </p>
          <h2 className="text-3xl font-semibold tracking-tight">
            Three rules. High precision.
          </h2>
          <p className="mt-3 max-w-lg text-muted-foreground">
            We start with the patterns that hurt production the most. Wrong
            diagnoses destroy trust — so fewer, better rules win.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {detectionRules.map((rule) => (
            <Card key={rule.id} className="rounded-xl">
              <CardContent className="p-6">
                <code className="mb-4 block text-xs text-muted-foreground">
                  {rule.id}
                </code>
                <h3 className="mb-3 text-base font-medium">{rule.label}</h3>
                <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                  {rule.description}
                </p>
                <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                  {rule.example}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator />

      {/* Code snippet */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid grid-cols-1 items-center gap-16 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Setup
            </p>
            <h2 className="mb-4 text-3xl font-semibold tracking-tight">
              Zero manual configuration
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              The CLI scaffolds{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                instrumentation.ts
              </code>
              , installs the agent, and writes the config file with your project
              token. Compatible with Next.js 14+ and works on any self-hosting
              platform — Coolify, Dokploy, Railway, Fly.io.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {["Coolify", "Dokploy", "Railway", "Fly.io", "Vercel"].map(
                (p) => (
                  <Badge key={p} variant="secondary" className="text-xs">
                    {p}
                  </Badge>
                )
              )}
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/30 p-6">
            <div className="mb-3 flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-border" />
              <div className="h-3 w-3 rounded-full bg-border" />
              <div className="h-3 w-3 rounded-full bg-border" />
              <span className="ml-2 text-xs text-muted-foreground">
                terminal
              </span>
            </div>
            <pre className="overflow-x-auto text-sm leading-relaxed">
              <code className="text-foreground">
                <span className="text-muted-foreground"># install and configure everything</span>
                {"\n"}
                <span>npx @codebaz/nextdoctor init</span>
                {"\n\n"}
                <span className="text-muted-foreground"># start your app as usual</span>
                {"\n"}
                <span>pnpm dev</span>
                {"\n\n"}
                <span className="text-muted-foreground"># open the dashboard at</span>
                {"\n"}
                <span>http://localhost:3001</span>
              </code>
            </pre>
          </div>
        </div>
      </section>

      <Separator />

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-12">
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Pricing
          </p>
          <h2 className="text-3xl font-semibold tracking-tight">
            Simple. No surprises.
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`rounded-xl ${plan.highlight ? "border-foreground/30 ring-1 ring-foreground/10" : ""}`}
            >
              <CardContent className="p-6">
                {plan.highlight && (
                  <Badge className="mb-4 text-xs">Most popular</Badge>
                )}
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <div className="my-4 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">
                    {plan.period}
                  </span>
                </div>
                <ul className="mb-6 space-y-2">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={plan.highlight ? "default" : "outline"}
                  size="sm"
                >
                  {plan.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          Need enterprise self-hosting with 99.9% SLA?{" "}
          <Link href="#" className="underline underline-offset-4">
            Talk to us
          </Link>
          .
        </p>
      </section>

      <Separator />

      {/* Stack */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid grid-cols-1 items-start gap-16 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Stack
            </p>
            <h2 className="mb-4 text-3xl font-semibold tracking-tight">
              Built on the best of the ecosystem
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              No unnecessary abstractions. Pragmatic choices you already know
              and trust.
            </p>
          </div>
          <div className="divide-y divide-border/40">
            {stackItems.map((item) => (
              <div
                key={item.tech}
                className="flex items-center justify-between py-4"
              >
                <span className="text-sm font-medium">{item.tech}</span>
                <span className="text-sm text-muted-foreground">
                  {item.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Separator />

      {/* Beta CTA */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-12 text-center">
          <Badge variant="outline" className="mb-6 text-xs">
            🚧 Beta — join early, shape the product
          </Badge>
          <h2 className="mb-4 text-4xl font-semibold tracking-tight">
            Try it before everyone else
          </h2>
          <p className="mx-auto mb-8 max-w-md text-muted-foreground leading-relaxed">
            NextDoctor is in beta. We are looking for developers who self-host
            Next.js apps and want better production visibility. Your feedback
            directly shapes what gets built next.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/auth/login">
              <Button size="lg">Login</Button>
            </Link>
            <Button size="lg" variant="outline">
              View repository
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-xs text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">NextDoctor</span>
            <Badge variant="secondary" className="text-xs">
              Beta
            </Badge>
          </div>
          <p>Built for developers who self-host Next.js.</p>
          <nav className="flex gap-4">
            <Link href="#" className="hover:text-foreground transition-colors">
              Docs
            </Link>
            <Link href="#" className="hover:text-foreground transition-colors">
              GitHub
            </Link>
            <Link href="#" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}