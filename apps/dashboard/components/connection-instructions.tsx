"use client"

import { Key, Terminal } from "lucide-react"
import { CopyButton } from "@/components/copy-button"

interface ConnectionInstructionsProps {
  token: string
}

export function ConnectionInstructions({ token }: ConnectionInstructionsProps) {
  return (
    <div className="flex flex-col gap-4 text-left">
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-1 flex items-center gap-2 text-sm font-medium">
          <Key className="size-4" />
          API token
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 overflow-hidden text-ellipsis rounded-md bg-muted px-3 py-2 text-sm font-mono">
            {token}
          </code>
          <CopyButton value={token} label="Token copied" />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Set this as <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">NEXTDOCTOR_PROJECT_TOKEN</code> in your deployment environment.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="mb-1 flex items-center gap-2 text-sm font-medium">
          <Terminal className="size-4" />
          Quick start
        </div>
        <p className="mb-2 text-xs text-muted-foreground">
          Run this in your Next.js project root to install and configure the agent:
        </p>
        <code className="block rounded-md bg-muted px-3 py-2 text-sm font-mono">
          npx @codebaz/nextdoctor init
        </code>
        <p className="mt-2 text-xs text-muted-foreground">
          The endpoint is pre-configured — no additional setup needed.
        </p>
      </div>
    </div>
  )
}
