import * as React from "react"
import { mainOrigin } from "@/lib/origins"

/* eslint-disable @next/next/no-img-element -- The crest is a static file with fixed dimensions and needs no image optimization. */

// The CyberICEBox crest: a static, cached file from the design system (public/crest-128.png, 128x125), not embedded in the page.
export const CREST_SRC = "/crest-128.png"

export interface LogoProps {
  /** Rendered height in px (width scales with the 128:125 aspect). */
  size?: number
  className?: string
  /**
   * Where the brand mark links. Defaults to the landing (apex) origin so the
   * organisation logo navigates home from every app. Pass `null` to render a
   * non-linking mark (e.g. when an ancestor already wraps it in an anchor).
   */
  href?: string | null
}

// Shared landing origin; falls back to "/" when the public domain is unset.
const LANDING_HREF = mainOrigin

export function Logo({ size = 64, className, href }: LogoProps) {
  const img = (
    <img
      src={CREST_SRC}
      alt="CyberICEBox"
      width={Math.round((size * 128) / 125)}
      height={size}
      className={className}
      style={{ display: "inline-block", objectFit: "contain" }}
    />
  )
  const target = href === null ? null : href ?? LANDING_HREF
  if (!target) return img
  return (
    <a href={target} aria-label="CyberICEBox" style={{ display: "inline-flex", lineHeight: 0 }}>
      {img}
    </a>
  )
}
