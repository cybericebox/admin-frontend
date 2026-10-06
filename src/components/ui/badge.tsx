import type { HTMLAttributes } from "react"
import { cn } from "@/utils/cn"

export type BadgeTone = "neutral" | "ok" | "warn" | "danger" | "info"

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: "",
  ok: "ib-tag--ok",
  warn: "ib-tag--warn",
  danger: "ib-tag--danger",
  info: "ib-tag--category",
}

// One status label for the panel (DS tag.css): 24px high, 22px at size="sm" for dense tables. Colour never carries the meaning alone:
// the text says it. Replaces the hand-made badge variants.
export function Badge({ tone = "neutral", size, className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone; size?: "sm" }) {
  return <span className={cn("ib-tag", size === "sm" && "ib-tag--sm", TONE_CLASS[tone], className)} {...props} />
}
