import { useEffect, useState } from "react"
import { apiGet } from "@/api/client"
import { notifVariableDescription } from "@/utils/notifType"

export type NotifType = { Type: string; Channels: string[]; Variables: { Name: string; Description: string; Default: string }[] }

// useNotificationTypes loads the notification-type catalog once.
export function useNotificationTypes(): NotifType[] {
  const [types, setTypes] = useState<NotifType[]>([])
  useEffect(() => {
    let cancelled = false
    apiGet<NotifType[]>("/api/notifications/types")
      .then((d) => { if (!cancelled) setTypes(Array.isArray(d) ? d.map((kind) => ({ ...kind, Variables: (kind.Variables ?? []).map((variable) => ({ ...variable, Description: notifVariableDescription(variable.Name, variable.Description) })) })) : []) })
      .catch(() => { if (!cancelled) setTypes([]) })
    return () => { cancelled = true }
  }, [])
  return types
}
