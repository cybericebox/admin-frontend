"use client"

import type { ReactNode } from "react"
import { Breadcrumbs, type Crumb } from "@/components/ui/breadcrumbs"
import { usePageTitle } from "@/components/shell/PageTitle"

// The one page header (DS page-header.css): breadcrumbs, the page's only h1, count, one sub line, actions, then a filters row.
// A string title also becomes the document title.
export function PageHeader({ title, count, sub, actions, crumbs, filters }: {
  title: ReactNode
  count?: number | string
  sub?: ReactNode
  actions?: ReactNode
  crumbs?: readonly Crumb[]
  filters?: ReactNode
}) {
  usePageTitle(typeof title === "string" ? title : null)
  return (
    <header className="ib-page-header">
      {crumbs && crumbs.length > 0 && <Breadcrumbs items={crumbs} />}
      <div className="ib-page-header__top">
        <div className="ib-page-header__heading">
          <h1 className="ib-page-header__title">{title}{count !== undefined && <span className="ib-page-header__count">{count}</span>}</h1>
          {sub && <p className="ib-page-header__sub">{sub}</p>}
        </div>
        {actions && <div className="ib-page-header__actions">{actions}</div>}
      </div>
      {filters && <div className="ib-page-header__filters">{filters}</div>}
    </header>
  )
}
