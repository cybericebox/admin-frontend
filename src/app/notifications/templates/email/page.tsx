"use client"
import Link from "next/link"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { t } from "@/i18n/t"
import { useNotificationTypes } from "@/components/notifications/templateTypes"

/**
 * Email templates index page (SP2).
 *
 * Thin index: lists email-channel notification types from the catalog and
 * provides a "New email template" link to the block-based detail editor.
 * The full grouped/versioned list is deferred to SP3.
 *
 * The old TemplateEditorShell is intentionally NOT used here; it remains
 * mounted in the in-app page (SP5 scope).
 */
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
      <EmailTemplateIndex />
    </RequirePermission>
  )
}

function EmailTemplateIndex() {
  const types = useNotificationTypes()
  const emailTypes = types.filter((nt) => nt.Channels.includes("email"))

  return (
    <div className="frost-in space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">
          {t("admin.notif.tpl.email")}
        </h1>
        <Link
          href="/notifications/templates/email/detail"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          + {t("admin.notif.tpl.new")}
        </Link>
      </div>

      {/* Email notification types list */}
      {emailTypes.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("admin.notif.tpl.empty")}</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-background">
          {emailTypes.map((nt) => (
            <li key={nt.Type} className="flex items-center justify-between px-4 py-3">
              <div>
                <span className="text-sm font-medium text-foreground">{nt.Type}</span>
                {nt.Variables.length > 0 && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {nt.Variables.length} {t("admin.notif.tpl.variables")}
                  </span>
                )}
              </div>
              <Link
                href="/notifications/templates/email/detail"
                className="text-xs text-primary hover:underline"
              >
                {t("admin.notif.tpl.new")}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
