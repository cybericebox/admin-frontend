import { exercisesOrigin } from "@/lib/origins"

export type AuditTargetPart = { kind: string; id: string; href?: string; external?: boolean }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Splits a Target of the audit log («event:<uuid> team:<uuid>», or route params like
 * «eventID:<uuid>») into parts. A part links to the admin page of its object when one
 * exists: event and user detail pages, the agents and labs pages, the exercise in the catalog.
 */
export function parseAuditTarget(target: string): AuditTargetPart[] {
  return target.split(/\s+/).filter(Boolean).map((token) => {
    const at = token.indexOf(":")
    if (at < 0) return { kind: "", id: token }
    // Route params end in ID («eventID», «userID»): the kind is what comes before.
    const kind = token.slice(0, at).replace(/(?<=.)ID$/i, "").toLowerCase()
    const id = token.slice(at + 1)
    if (!UUID.test(id)) return { kind, id }
    const enc = encodeURIComponent(id)
    switch (kind) {
      case "event": return { kind, id, href: `/events/detail?id=${enc}` }
      case "user": return { kind, id, href: `/users/detail?id=${enc}` }
      case "agent": return { kind, id, href: "/agents" }
      case "test-lab":
      case "testlab": return { kind: "test-lab", id, href: "/labs" }
      case "exercise": return { kind, id, href: `${exercisesOrigin.replace(/\/$/, "")}/detail?id=${enc}`, external: true }
      default: return { kind, id }
    }
  })
}
