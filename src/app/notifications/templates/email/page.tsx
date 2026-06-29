"use client"
import Link from "next/link"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { t } from "@/i18n/t"
import { TemplateEditorShell } from "@/components/notifications/TemplateEditorShell"

export default function Page() {
  return (
    <RequirePermission
      perm="notifications.templates.read"
      fallback={<div className="frost-panel frost-in rounded-lg p-8 text-center text-sm text-muted-foreground">{t("admin.notif.noAccess")}</div>}
    >
      <div className="frost-in space-y-4">
        {/* Quick-link to the new block-template editor (SP2). Full grouped list is SP3. */}
        <div className="flex items-center justify-end">
          <Link
            href="/notifications/templates/email/detail"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            + {t("admin.notif.tpl.new")}
          </Link>
        </div>
        <TemplateEditorShell
          channel="email"
          apiBase="/api/notifications/templates/email"
          fields={[
            { key: "Subject", label: t("admin.notif.tpl.subject") },
            { key: "Preheader", label: t("admin.notif.tpl.preheader") },
            { key: "Body", label: t("admin.notif.tpl.body"), multiline: true },
          ]}
        />
      </div>
    </RequirePermission>
  )
}
