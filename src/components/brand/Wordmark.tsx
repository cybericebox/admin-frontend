import * as React from "react"
import { Logo } from "./Logo"

// Brand lockup — the old crest logo plus the CyberICEBox wordmark.
export function Wordmark({
  className,
  withMark = true,
  size = "md",
}: {
  className?: string
  withMark?: boolean
  size?: "sm" | "md" | "lg"
}) {
  const text =
    size === "lg" ? "text-2xl" : size === "sm" ? "text-base" : "text-lg"
  const mark = size === "lg" ? 40 : size === "sm" ? 24 : 30
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${text} ${className ?? ""}`}>
      {withMark && <Logo size={mark} />}
      <span className="text-foreground">
        Cyber<span className="text-primary">ICE</span>Box
      </span>
    </span>
  )
}
