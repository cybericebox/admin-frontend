"use client"
import { useSyncExternalStore } from "react"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { t } from "@/i18n/t"
import { ErrorGroupsList } from "./ErrorGroupsList"
import { ErrorGroupDetailPage } from "./ErrorGroupDetail"
import { ErrorNotifySettings } from "./ErrorNotifySettings"
import { NotFoundStats } from "./NotFoundStats"

const DETAIL_PATH = /^\/errors\/([0-9a-fA-F-]{36})\/?$/

const subscribe = (notify: () => void) => { window.addEventListener("popstate", notify); return () => window.removeEventListener("popstate", notify) }

/**
 * /errors is the list, /errors/<groupID> a group. The static export has one page, `errors`: nginx serves it for
 * any /errors/<id> (and `next dev` rewrites it), and the id is read from the address here.
 */
export function groupIDOf(pathname: string): string | null {
  return DETAIL_PATH.exec(pathname)?.[1] ?? null
}

export function ErrorsPage() {
  const pathname = useSyncExternalStore(subscribe, () => window.location.pathname, () => "/errors")
  const groupID = groupIDOf(pathname)
  return (
    <RequirePermission perm="platform.errors.read" fallback={<p className="text-sm text-muted-foreground">{t("admin.errors.noAccess")}</p>}>
      <div className="frost-panel frost-in flex h-full min-h-0 flex-col overflow-hidden rounded-lg p-6">
        {groupID ? <ErrorGroupDetailPage key={groupID} groupID={groupID} /> : (
          <Tabs defaultValue="journal" className="flex min-h-0 flex-1 flex-col">
            <TabsList className="mb-4 w-fit">
              <TabsTrigger value="journal">{t("admin.errors.tab.journal")}</TabsTrigger>
              <TabsTrigger value="notFound">{t("admin.errors.tab.notFound")}</TabsTrigger>
              <TabsTrigger value="notify">{t("admin.errors.tab.notify")}</TabsTrigger>
            </TabsList>
            <TabsContent value="journal" forceMount className="mt-0 min-h-0 flex-1 data-[state=inactive]:hidden"><ErrorGroupsList /></TabsContent>
            <TabsContent value="notFound" className="mt-0 min-h-0 flex-1 overflow-auto"><NotFoundStats /></TabsContent>
            <TabsContent value="notify" className="mt-0 min-h-0 flex-1 overflow-auto"><ErrorNotifySettings /></TabsContent>
          </Tabs>
        )}
      </div>
    </RequirePermission>
  )
}
