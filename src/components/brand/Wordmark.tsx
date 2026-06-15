import * as React from "react"
import { IceMark } from "./IceMark"

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
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${text} ${className ?? ""}`}>
      {withMark && <IceMark className="text-foreground" size={size === "lg" ? 32 : 24} />}
      <span className="text-foreground">
        Cyber<span className="text-primary glow">ICE</span>Box
      </span>
    </span>
  )
}
