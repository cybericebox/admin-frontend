import type { Role } from "@/lib/useRole"

// Mirror of the backend rbac role→permission map (internal/model/rbac/permission.go).
// Keep in sync if backend role permissions change.
export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  super_admin: ["*"],
  admin: ["users", "events.read", "events.write", "platform.audit.read", "events.solution-attempts.read", "events.solution-attempts.write", "notifications.self"],
  admin_viewer: ["users.read", "events.read", "events.solution-attempts.read", "notifications.self"],
  user: ["notifications.self"],
}

// Display order for role pickers (highest privilege first).
const ROLE_ORDER: Role[] = ["super_admin", "admin", "admin_viewer", "user"]

const ROLE_RANK: Record<Role, number> = { user: 0, admin_viewer: 1, admin: 2, super_admin: 3 }

// assignableRoles returns the roles the caller may give an account whose current role is
// `current` ("" for a new account or an invitation), mirroring backend CanSetRole: the caller
// must hold every permission the role grants, and only a super_admin may RAISE anyone to
// admin or above (an admin may lower an admin or keep one, never make one).
// `can` is the dotted-prefix predicate from useRole.
export function assignableRoles(
  can: (required: string) => boolean,
  callerRole: Role | null,
  current: Role | "" = "",
): Role[] {
  return ROLE_ORDER.filter((role) => {
    if (!ROLE_PERMISSIONS[role].every((perm) => can(perm))) return false
    if (callerRole === "super_admin") return true
    const currentRank = current === "" ? -1 : ROLE_RANK[current]
    return !(ROLE_RANK[role] >= ROLE_RANK.admin && ROLE_RANK[role] > currentRank)
  })
}
