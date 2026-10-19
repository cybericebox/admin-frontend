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

// Account-management levels (backend rbac.roleLevel): admin and admin_viewer are one level, super_admin above both.
const ROLE_LEVEL: Record<Role, number> = { user: 0, admin_viewer: 1, admin: 1, super_admin: 2 }

/** Mirrors backend rbac.CanManageAccount: only a higher role changes the role of, blocks or deletes an account. A
 * super_admin manages everyone; an admin manages only regular users, never another admin, admin_viewer or super_admin. */
export function canManageAccount(callerRole: Role | null, targetRole: string): boolean {
  if (callerRole === "super_admin") return true
  if (!callerRole || !(targetRole in ROLE_LEVEL)) return false
  return ROLE_LEVEL[callerRole] > ROLE_LEVEL[targetRole as Role]
}

// assignableRoles returns the roles the caller may give an account whose current role is `current` ("" for a new
// account or an invitation), mirroring backend CanSetRole: the caller must hold every permission the role grants, and
// below super_admin the account must be one the caller manages and the role must stay below the caller's own level
// (an admin gives only «user»). `can` is the dotted-prefix predicate from useRole.
export function assignableRoles(
  can: (required: string) => boolean,
  callerRole: Role | null,
  current: Role | "" = "",
): Role[] {
  return ROLE_ORDER.filter((role) => {
    if (!ROLE_PERMISSIONS[role].every((perm) => can(perm))) return false
    if (callerRole === "super_admin") return true
    if (current !== "" && !canManageAccount(callerRole, current)) return false
    return canManageAccount(callerRole, role)
  })
}
