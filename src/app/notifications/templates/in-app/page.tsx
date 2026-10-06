"use client"

/**
 * In-app templates grouped list page (SP5 Task 4).
 *
 * Route: /notifications/templates/in-app
 *
 * Fetches `latestInAppTemplates()` on mount and renders one row per
 * notification type showing the effective version status, a draft-pending
 * badge when a draft exists alongside a published version, the last editor's
 * name, and a link to the detail editor.
 *
 * pickVersion precedence: Draft > Published > Unpublished — the row link
 * always targets the most editable / interesting version.
 */

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { t } from "@/i18n/t"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { NoAccess } from "@/components/rbac/NoAccess"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadError } from "@/components/ui/load-error"
import { StatusPill } from "@/components/notifications/StatusPill"
import {
  latestInAppTemplates,
  type InAppLatestEntry,
  type InAppTemplate,
} from "@/api/notifications/inAppTemplates"
import {
  effectiveStatus,
  hasDraftPending,
  statusLabelKey,
} from "@/lib/templateStatus"
import { useUserNames } from "@/lib/userNames"
import { notifTypeLabel } from "@/utils/notifType"
import { useRole } from "@/lib/useRole"
import { LoadingArea } from "@/components/ui/spinner"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { formatDateTime } from "@/lib/locale"
import { Plus } from "lucide-react"

// ── Helper: pick the most relevant version for row link ──────────────────────

function pickVersion(entry: InAppLatestEntry): InAppTemplate | null {
  return entry.Draft ?? entry.Published ?? entry.Unpublished
}

// ── Helper: pick the most relevant UpdatedByUserID (fallback across versions) ─

function pickUpdatedBy(entry: InAppLatestEntry): string | null {
  // Prefer effective version's UpdatedByUserID
  const status = effectiveStatus(entry)
  const effectiveVersion =
    status === "published"
      ? entry.Published
      : status === "draft"
        ? entry.Draft
        : entry.Unpublished

  if (effectiveVersion?.UpdatedByUserID) {
    return effectiveVersion.UpdatedByUserID
  }

  // Fallback to first non-null UpdatedByUserID among Draft, Published, Unpublished
  if (entry.Draft?.UpdatedByUserID) return entry.Draft.UpdatedByUserID
  if (entry.Published?.UpdatedByUserID) return entry.Published.UpdatedByUserID
  if (entry.Unpublished?.UpdatedByUserID) return entry.Unpublished.UpdatedByUserID

  return null
}

// ── Inner component (needs Suspense wrapper for static export) ────────────────

function InAppTemplateList() {
  const canWrite = useRole().can("notifications.templates.write")
  const [entries, setEntries] = useState<InAppLatestEntry[] | null>(null)
  const [loadError, setLoadError] = useState<{ cause: unknown } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [search, setSearch] = useState("")

  useEffect(() => {
    latestInAppTemplates()
      .then(setEntries)
      .catch((cause) => setLoadError({ cause }))
  }, [attempt])

  // Collect all UpdatedByUserID values using fallback logic
  const userIds: (string | null | undefined)[] = (entries ?? []).map((entry) => {
    return pickUpdatedBy(entry)
  })

  const userNames = useUserNames(userIds)

  // ── Loading state ─────────────────────────────────────────────────────────
  if (!entries && !loadError) {
    return (
      <LoadingArea className="frost-panel frost-in h-full rounded-lg" label={t("admin.loading")} />
    )
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <LoadError message={t("admin.notif.inapp.list.loadError")} error={loadError.cause} onRetry={() => { setLoadError(null); setAttempt((key) => key + 1) }} className="frost-panel frost-in h-full rounded-lg" />
    )
  }

  const list = [...(entries ?? [])].filter((entry) => notifTypeLabel(entry.NotificationType).toLocaleLowerCase().includes(search.toLocaleLowerCase()) || entry.NotificationType.toLowerCase().includes(search.toLowerCase())).sort((a, b) => notifTypeLabel(a.NotificationType).localeCompare(notifTypeLabel(b.NotificationType), "uk"))

  return (
    <div className="frost-in space-y-4">
      <PageHeader
        title={t("admin.notif.list.title")}
        actions={canWrite && <Button asChild><Link href="/notifications/templates/in-app/detail"><Plus aria-hidden className="h-4 w-4" />{t("admin.notif.list.new")}</Link></Button>}
        filters={<Input type="search" value={search} onChange={(event) => setSearch(event.target.value)}
          aria-label={t("admin.notif.list.search")} placeholder={t("admin.notif.list.search")} className="max-w-sm" />}
      />

      {/* Empty state */}
      {list.length === 0 ? (
        <div className="rounded-lg border border-border bg-background"><EmptyState message={t("admin.notif.inapp.list.empty")} /></div>
      ) : (
        /* Grouped version table */
        <div className="overflow-hidden rounded-lg border border-border bg-background">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground">
                <th className="px-4 py-2.5 text-left">{t("admin.notif.list.colType")}</th>
                <th className="px-4 py-2.5 text-left">{t("admin.notif.list.colStatus")}</th>
                <th className="px-4 py-2.5 text-left">{t("admin.notif.list.colUpdated")}</th>
                <th className="px-4 py-2.5 text-left">{t("admin.notif.list.colUpdatedBy")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.map((entry) => {
                const status = effectiveStatus(entry)
                const draftPending = hasDraftPending(entry)
                const version = pickVersion(entry)

                // Effective version for date/editor display
                const effectiveVersion =
                  status === "published"
                    ? entry.Published
                    : status === "draft"
                      ? entry.Draft
                      : entry.Unpublished

                const updatedAt = effectiveVersion?.UpdatedAt
                  ? formatDateTime(effectiveVersion.UpdatedAt, { dateStyle: "short", timeStyle: "short" })
                  : "—"

                const editorId = pickUpdatedBy(entry)
                const editor = editorId ? userNames[editorId] : null

                const rowHref = version
                  ? `/notifications/templates/in-app/detail?id=${version.ID}`
                  : `/notifications/templates/in-app/detail?type=${encodeURIComponent(entry.NotificationType)}`

                return (
                  <tr
                    key={entry.NotificationType}
                    className="hover:bg-[var(--ib-hover)] transition-colors"
                  >
                    {/* Type */}
                    <td className="px-4 py-3">
                      {version || canWrite ? <Link
                        href={rowHref}
                        className="font-medium text-foreground hover:text-primary hover:underline"
                      >
                        {notifTypeLabel(entry.NotificationType)}
                      </Link> : <span className="font-medium text-foreground">{notifTypeLabel(entry.NotificationType)}</span>}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {status ? (
                          <StatusPill
                            status={status}
                            label={t(statusLabelKey(status))}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">{t("admin.notif.tpl.notConfigured")}</span>
                        )}
                        {draftPending && (
                          <Badge tone="warn" size="sm">{t("admin.notif.list.draftPending")}</Badge>
                        )}
                        {[entry.Draft, entry.Published, entry.Unpublished].filter((item): item is InAppTemplate => Boolean(item)).map((item) =>
                          <Link key={item.ID} href={`/notifications/templates/in-app/detail?id=${item.ID}`}
                            className="text-xs text-primary underline-offset-2 hover:underline">{t(`admin.notif.tpl.version.${item.Status}`)}</Link>,
                        )}
                      </div>
                    </td>

                    {/* Updated at */}
                    <td className="px-4 py-3 text-muted-foreground">
                      {updatedAt}
                    </td>

                    {/* Updated by */}
                    <td className="px-4 py-3">
                      {editor ? (
                        <Link
                          href={editor.href}
                          className="text-primary hover:underline"
                        >
                          {editor.name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Page export ───────────────────────────────────────────────────────────────

export default function Page() {
  return (
    <RequirePermission
      perm="notifications.templates.read"
      fallback={<NoAccess />}
    >
      <Suspense
        fallback={
          <LoadingArea className="frost-panel frost-in h-full rounded-lg" label={t("admin.loading")} />
        }
      >
        <InAppTemplateList />
      </Suspense>
    </RequirePermission>
  )
}
