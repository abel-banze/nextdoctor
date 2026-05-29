"use client"

import { useState } from "react"
import { Copy, Check } from "lucide-react"
import { copyToClipboard } from "@/lib/copy"

interface CopyButtonProps {
  value: string
  label?: string
}

export function CopyButton({ value, label }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await copyToClipboard(value, label ?? "Copied")
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy"
      className="inline-flex size-8 items-center justify-center rounded-lg border border-input bg-background hover:bg-muted"
    >
      {copied ? (
        <Check className="size-3.5 text-green-600" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </button>
  )
}
