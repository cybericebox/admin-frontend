"use client"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { t } from "@/i18n/t"
import { TemplateEditorShell } from "@/components/notifications/TemplateEditorShell"

export default function Page() {
  return (
    <RequirePermission
      perm="notifications.templates.read"
      fallback={<div className="frost-panel frost-in rounded-lg p-8 text-center text-sm text-muted-foreground">{t("admin.notif.noAccess")}</div>}
    >
      <div className="frost-in">
        <TemplateEditorShell
          channel="inapp"
          apiBase="/api/notifications/templates/inapp"
          fields={[
            { key: "Title", label: t("admin.notif.tpl.title") },
            { key: "Body", label: t("admin.notif.tpl.body"), multiline: true },
            { key: "Link", label: t("admin.notif.tpl.link") },
          ]}
        />
      </div>
    </RequirePermission>
  )
}
