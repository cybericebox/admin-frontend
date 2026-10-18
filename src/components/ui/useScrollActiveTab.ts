"use client"

import * as React from "react"

const ACTIVE = '[role="tab"][aria-selected="true"], a[aria-current="page"]'

// Keeps the active tab visible inside a horizontally scrolling tab row: on mount and whenever the selection changes.
// Scrolls the row itself (never the page), so nothing jumps vertically.
export function useScrollActiveTab(list: React.RefObject<HTMLElement | null>) {
  React.useEffect(() => {
    const node = list.current
    if (!node) return
    const reveal = () => {
      const active = node.querySelector<HTMLElement>(ACTIVE)
      if (!active || node.scrollWidth <= node.clientWidth) return
      const box = node.getBoundingClientRect()
      const rect = active.getBoundingClientRect()
      const left = rect.left - box.left + node.scrollLeft
      const right = left + rect.width
      const pad = 16
      let target = node.scrollLeft
      if (left - pad < node.scrollLeft) target = left - pad
      else if (right + pad > node.scrollLeft + node.clientWidth) target = right + pad - node.clientWidth
      target = Math.max(0, target)
      if (target !== node.scrollLeft) node.scrollTo({ left: target, behavior: "auto" })
    }
    reveal()
    const observer = new MutationObserver(reveal)
    observer.observe(node, { attributes: true, attributeFilter: ["aria-selected", "aria-current"], subtree: true, childList: true })
    return () => observer.disconnect()
  }, [list])
}
