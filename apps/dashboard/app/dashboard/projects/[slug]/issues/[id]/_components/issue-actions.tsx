"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export function IssueActions({
  issueId,
  resolvedAt,
}: {
  issueId: string
  resolvedAt: string | null
}) {
  const router = useRouter()
  const [resolving, setResolving] = useState(false)
  const [aiRunning, setAiRunning] = useState(false)

  async function handleResolve() {
    setResolving(true)
    try {
      await fetch(`/api/issues/${issueId}/resolve`, {
        method: "PATCH",
        credentials: "include",
      })
      router.refresh()
    } catch {
      /* ignore */
    }
    setResolving(false)
  }

  async function handleRunAi() {
    setAiRunning(true)
    try {
      await fetch(`/api/ai/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ issueId }),
      })
      // Wait 2s then refresh to show pending status
      setTimeout(() => {
        router.refresh()
      }, 2000)
    } catch {
      /* ignore */
    }
    setAiRunning(false)
  }

  return (
    <div className="flex shrink-0 gap-2">
      {!resolvedAt && (
        <button
          type="button"
          onClick={handleResolve}
          disabled={resolving}
          className="inline-flex h-9 items-center justify-center rounded-lg bg-green-600 px-4 text-sm font-medium text-white transition-all hover:bg-green-700 disabled:pointer-events-none disabled:opacity-50"
        >
          {resolving ? "Resolving..." : "Mark resolved"}
        </button>
      )}
      <button
        type="button"
        onClick={handleRunAi}
        disabled={aiRunning}
        className="inline-flex h-9 items-center justify-center rounded-lg border border-input bg-background px-4 text-sm font-medium transition-all hover:bg-muted disabled:opacity-50"
      >
        Run AI Doctor
      </button>
    </div>
  )
}
