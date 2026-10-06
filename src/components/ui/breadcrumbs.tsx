import Link from "next/link"
import { t } from "@/i18n/t"
import { cn } from "@/utils/cn"

export type Crumb = { label: string; href?: string }

// The one way back on detail pages: «Розділ / Об'єкт». Every item but the last is a link, the last is the current page.
export function Breadcrumbs({ items, className }: { items: readonly Crumb[]; className?: string }) {
  if (items.length === 0) return null
  return (
    <nav aria-label={t("ui.breadcrumbs")} className={className}>
      <ol className={cn("ib-topbar__crumbs")}>
        {items.map((item, index) => {
          const last = index === items.length - 1
          return (
            <li key={`${index}-${item.label}`}>
              {item.href && !last
                ? <Link href={item.href} className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ib-action)]">{item.label}</Link>
                : <span aria-current={last ? "page" : undefined} className={cn("truncate", last && "text-[var(--ib-ink)]")}>{item.label}</span>}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
