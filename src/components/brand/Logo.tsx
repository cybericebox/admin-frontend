import * as React from "react"
import Link from "next/link"

/* eslint-disable @next/next/no-img-element -- The crest is a static file with fixed dimensions and needs no image optimization. */

// The CyberICEBox crest: a static, cached file from the design system (public/crest-128.png, 128x125), not embedded in the page.
export const CREST_SRC = "/crest-128.png"

export interface LogoProps {
  /** Rendered height in px (width scales with the 128:125 aspect). */
  size?: number
  className?: string
  /**
   * Where the brand mark links. By default it leads to NEXT_PUBLIC_MAIN_SITE_URL when that is set and to `/` of this site when it is not
   * (two anchors, one of them hidden by src/styles/cfg.css). Pass `null` to render a non-linking mark (e.g. when an ancestor already
   * wraps it in an anchor).
   */
  href?: string | null
}

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
  if (href === null) return img
  const anchor = { "aria-label": "CyberICEBox", style: { display: "inline-flex", lineHeight: 0 } } as const
  if (href !== undefined) return <a href={href} {...anchor}>{img}</a>
  return (
    <>
      <a className="cfg-main-only" href={process.env.NEXT_PUBLIC_MAIN_SITE_URL} {...anchor}>{img}</a>
      <Link className="cfg-main-off" href="/" prefetch={false} {...anchor}>{img}</Link>
    </>
  )
}
