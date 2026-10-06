"use client"
import { Suspense, useSyncExternalStore } from "react"
import { usePathname } from "next/navigation"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { NoAccess } from "@/components/common/NoAccess"
import { PageHeader } from "@/components/ui/page-header"
import { LoadingArea } from "@/components/ui/spinner"
import { useUrlState } from "@/lib/useUrlState"
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

const TABS = ["journal", "notFound", "notify"]

function ErrorsList() {
  const [url, setUrl] = useUrlState({ tab: "journal" })
  const tab = TABS.includes(url.tab) ? url.tab : "journal"
  return <>
    <PageHeader title={t("admin.nav.errors")} sub={t("admin.errors.sub")} />
    <Tabs value={tab} onValueChange={(value) => setUrl({ tab: value })} className="flex min-h-0 flex-1 flex-col">
      <TabsList className="mb-4 w-fit" aria-label={t("admin.errors.tabs")}>
        <TabsTrigger value="journal">{t("admin.errors.tab.journal")}</TabsTrigger>
        <TabsTrigger value="notFound">{t("admin.errors.tab.notFound")}</TabsTrigger>
        <TabsTrigger value="notify">{t("admin.errors.tab.notify")}</TabsTrigger>
      </TabsList>
      <TabsContent value="journal" forceMount className="mt-0 min-h-0 flex-1 data-[state=inactive]:hidden"><ErrorGroupsList /></TabsContent>
      <TabsContent value="notFound" className="mt-0 min-h-0 flex-1 overflow-auto"><NotFoundStats /></TabsContent>
      <TabsContent value="notify" className="mt-0 min-h-0 flex-1 overflow-auto"><ErrorNotifySettings /></TabsContent>
    </Tabs>
  </>
}

export function ErrorsPage() {
  // usePathname re-renders the page when a link moves between the list and a group; the address is the source.
  const routed = usePathname()
  const pathname = useSyncExternalStore(subscribe, () => window.location.pathname, () => routed || "/errors")
  const groupID = groupIDOf(pathname)
  return (
    <RequirePermission perm="platform.errors.read" fallback={<NoAccess message={t("admin.errors.noAccess")} />}>
      <div className="flex h-full min-h-0 flex-col gap-4">
        {groupID ? <ErrorGroupDetailPage key={groupID} groupID={groupID} /> : (
          <Suspense fallback={<LoadingArea className="h-full" label={t("admin.loading")} />}><ErrorsList /></Suspense>
        )}
      </div>
    </RequirePermission>
  )
}
