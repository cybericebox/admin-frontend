"use client"
import { Suspense, useSyncExternalStore } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { RequirePermission } from "@/components/rbac/RequirePermission"
import { NoAccess } from "@/components/rbac/NoAccess"
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
 * The query-based group link works on static hosts without server rewrites.
 * Legacy /errors/<id> links remain supported where nginx serves the errors page.
 */
export function groupIDOf(address: string): string | null {
  const [pathname, search = ""] = address.split("?", 2)
  const legacy = DETAIL_PATH.exec(pathname)?.[1]
  if (legacy) return legacy
  const id = new URLSearchParams(search).get("group")
  return /^\/errors\/?$/.test(pathname) && id && /^[0-9a-fA-F-]{36}$/.test(id) ? id : null
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

function ErrorsRoute() {
  // Next Link can change only the query without popstate or a pathname change.
  // Subscribe to both router values; legacy rewritten paths still come from the live address.
  const routed = usePathname()
  const params = useSearchParams()
  const address = useSyncExternalStore(subscribe, () => window.location.pathname + window.location.search, () => `${routed || "/errors"}${params?.size ? `?${params}` : ""}`)
  const groupID = groupIDOf(address)
  return (
    <RequirePermission perm="platform.errors.read" fallback={<NoAccess message={t("admin.errors.noAccess")} />}>
      <div className="flex min-h-full min-w-0 flex-col md:h-full md:min-h-0 gap-4">
        {groupID ? <Suspense fallback={<LoadingArea className="h-full" label={t("admin.loading")} />}><ErrorGroupDetailPage key={groupID} groupID={groupID} /></Suspense> : (
          <Suspense fallback={<LoadingArea className="h-full" label={t("admin.loading")} />}><ErrorsList /></Suspense>
        )}
      </div>
    </RequirePermission>
  )
}

export function ErrorsPage() {
  return <Suspense fallback={<LoadingArea className="h-full" label={t("admin.loading")} />}><ErrorsRoute /></Suspense>
}
