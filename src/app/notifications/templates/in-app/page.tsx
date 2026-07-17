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
  const [entries, setEntries] = useState<InAppLatestEntry[] | null>(null)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    latestInAppTemplates()
      .then(setEntries)
      .catch(() => setLoadError(true))
  }, [])

  // Collect all UpdatedByUserID values using fallback logic
  const userIds: (string | null | undefined)[] = (entries ?? []).map((entry) => {
    return pickUpdatedBy(entry)
  })

  const userNames = useUserNames(userIds)

  // ── Loading state ─────────────────────────────────────────────────────────
  if (!entries && !loadError) {
    return (
      <div className="frost-in flex items-center justify-center rounded-lg border border-border bg-background p-8">
        <span className="text-sm text-muted-foreground">{t("admin.loading")}</span>
      </div>
    )
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="frost-in rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center text-sm text-destructive">
        {t("admin.notif.inapp.list.loadError")}
      </div>
    )
  }

  const list = entries ?? []

  return (
    <div className="frost-in space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">
          {t("admin.notif.inapp.list.title")}
        </h1>
        <Link
          href="/notifications/templates/in-app/detail"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          + {t("admin.notif.inapp.list.new")}
        </Link>
      </div>

      {/* Empty state */}
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("admin.notif.inapp.list.empty")}</p>
      ) : (
        /* Grouped version table */
        <div className="overflow-hidden rounded-lg border border-border bg-background">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-medium uppercase tracking-wider text-muted-foreground">
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
                  ? new Date(effectiveVersion.UpdatedAt).toLocaleDateString()
                  : "—"

                const editorId = pickUpdatedBy(entry)
                const editor = editorId ? userNames[editorId] : null

                const rowHref = version
                  ? `/notifications/templates/in-app/detail?id=${version.ID}`
                  : `/notifications/templates/in-app/detail`

                return (
                  <tr
                    key={entry.NotificationType}
                    className="hover:bg-accent/40 transition-colors"
                  >
                    {/* Type */}
                    <td className="px-4 py-3">
                      <Link
                        href={rowHref}
                        className="font-medium text-foreground hover:text-primary hover:underline"
                      >
                        {notifTypeLabel(entry.NotificationType)}
                      </Link>
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
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                        {draftPending && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                            {t("admin.notif.list.draftPending")}
                          </span>
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
      fallback={
        <div className="frost-panel frost-in rounded-lg p-8 text-center text-sm text-muted-foreground">
          {t("admin.notif.noAccess")}
        </div>
      }
    >
      <Suspense
        fallback={
          <div className="frost-in flex items-center justify-center rounded-lg border border-border bg-background p-8">
            <span className="text-sm text-muted-foreground">{t("admin.loading")}</span>
          </div>
        }
      >
        <InAppTemplateList />
      </Suspense>
    </RequirePermission>
  )
}
