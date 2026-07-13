"use client"

import Link from "next/link"
import { t } from "@/i18n/t"
import { useRole } from "@/lib/useRole"
import { useUserNames } from "@/lib/userNames"
import { Button } from "@/components/ui/button"
import type { VersionListItem } from "@/api/exercises/versions"

function StatusPill({ status }: { status: VersionListItem["Status"] }) {
  const cls =
    status === "published"
      ? "bg-primary/15 text-primary"
      : status === "draft"
        ? "bg-secondary/40 text-foreground"
        : "bg-muted text-muted-foreground"
  return <span className={`rounded-full px-2 py-0.5 text-xs ${cls}`}>{t(`admin.ex.status.${status}`)}</span>
}

/**
 * VersionsTable — version history. Confirmation dialogs live with the parent:
 * callbacks fire on click, the page opens the dialog.
 */
export function VersionsTable({
  exerciseId,
  versions,
  busy,
  onPublish,
  onDiscard,
  onRollback,
}: {
  exerciseId: string
  versions: VersionListItem[]
  busy: boolean
  onPublish: () => void
  onDiscard: () => void
  onRollback: (versionId: string) => void
}) {
  const { can } = useRole()
  const names = useUserNames(versions.map((v) => v.CreatedBy))

  if (versions.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">{t("admin.exVersions.empty")}</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            <th className="px-3 py-2 font-medium">{t("admin.exVersions.col.status")}</th>
            <th className="px-3 py-2 font-medium">{t("admin.exVersions.col.date")}</th>
            <th className="px-3 py-2 font-medium">{t("admin.exVersions.col.author")}</th>
            <th className="px-3 py-2 font-medium">{t("admin.exVersions.col.variants")}</th>
            <th className="px-3 py-2 font-medium">{t("admin.exVersions.col.note")}</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {versions.map((v) => {
            const author = v.CreatedBy ? names[v.CreatedBy] : undefined
            return (
              <tr key={v.ID} className="border-b border-border/50">
                <td className="px-3 py-2"><StatusPill status={v.Status} /></td>
                <td className="px-3 py-2 text-muted-foreground">
                  {new Date(v.PublishedAt ?? v.CreatedAt).toLocaleString()}
                </td>
                <td className="px-3 py-2">
                  {author ? (
                    <Link href={author.href} className="text-primary hover:underline">{author.name}</Link>
                  ) : (
                    <span className="text-muted-foreground">{v.CreatedBy ? v.CreatedBy.slice(0, 8) : "—"}</span>
                  )}
                </td>
                <td className="px-3 py-2">{v.VariantCount}</td>
                <td className="max-w-xs truncate px-3 py-2 text-muted-foreground">{v.AdminNote || "—"}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap justify-end gap-2">
                    {v.Status === "draft" && can("exercises.write") && (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/exercises/draft?id=${exerciseId}`}>{t("admin.exVersions.edit")}</Link>
                      </Button>
                    )}
                    {v.Status === "draft" && can("exercises.publish") && (
                      <>
                        <Button size="sm" disabled={busy} onClick={onPublish}>{t("admin.exDetail.publish")}</Button>
                        <Button variant="outline" size="sm" disabled={busy} onClick={onDiscard}>
                          {t("admin.exDetail.discard")}
                        </Button>
                      </>
                    )}
                    {v.Status === "unpublished" && can("exercises.publish") && (
                      <Button variant="outline" size="sm" disabled={busy} onClick={() => onRollback(v.ID)}>
                        {t("admin.exVersions.rollback")}
                      </Button>
                    )}
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/exercises/draft?id=${exerciseId}&versionId=${v.ID}`}>
                        {t("admin.exVersions.view")}
                      </Link>
                    </Button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
