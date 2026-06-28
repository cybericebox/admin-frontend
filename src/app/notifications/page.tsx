"use client"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { t } from "@/i18n/t"
import { StatisticsTab } from "@/components/notifications/StatisticsTab"
import { LogsTab } from "@/components/notifications/LogsTab"
import { GlobalSettingsTab } from "@/components/notifications/GlobalSettingsTab"
import { TemplatesTab } from "@/components/notifications/TemplatesTab"

export default function Page() {
  return (
    <RequirePermission
      perm="notifications.templates.read"
      fallback={
        <div className="frost-panel frost-in rounded-lg p-8 text-center text-sm text-muted-foreground">{t("admin.notif.noAccess")}</div>
      }
    >
      <div className="frost-in">
        <Tabs defaultValue="statistics">
          <TabsList>
            <TabsTrigger value="statistics">{t("admin.notif.tab.statistics")}</TabsTrigger>
            <TabsTrigger value="logs">{t("admin.notif.tab.logs")}</TabsTrigger>
            <TabsTrigger value="settings">{t("admin.notif.tab.settings")}</TabsTrigger>
            <TabsTrigger value="templates">{t("admin.notif.tab.templates")}</TabsTrigger>
          </TabsList>
          <TabsContent value="statistics"><StatisticsTab /></TabsContent>
          <TabsContent value="logs"><LogsTab /></TabsContent>
          <TabsContent value="settings"><GlobalSettingsTab /></TabsContent>
          <TabsContent value="templates"><TemplatesTab /></TabsContent>
        </Tabs>
      </div>
    </RequirePermission>
  )
}
