import * as React from "react"

export function IceMark({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      {/* cube */}
      <path d="M16 3 L27 9 L27 23 L16 29 L5 23 L5 9 Z" />
      <path d="M16 3 L16 16 M16 16 L27 9 M16 16 L5 9" opacity="0.5" />
      {/* crystal facet */}
      <path d="M16 11 L20 16 L16 21 L12 16 Z" stroke="#38BDF8" />
      <path d="M16 11 L16 21 M12 16 L20 16" stroke="#38BDF8" opacity="0.7" />
    </svg>
  )
}
