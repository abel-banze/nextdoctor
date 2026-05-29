import * as React from "react"
import { cn } from "@/lib/utils"

function Separator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      className={cn("shrink-0 bg-border", "h-px w-full", className)}
      {...props}
    />
  )
}

export { Separator }
