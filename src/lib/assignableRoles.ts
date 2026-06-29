import type { Role } from "@/lib/useRole"

// Mirror of the backend rbac role→permission map (internal/model/rbac/permission.go).
// Keep in sync if backend role permissions change.
export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  super_admin: ["*"],
  admin: ["users", "notifications.self"],
  admin_viewer: ["users.read", "notifications.self"],
  user: ["notifications.self"],
}

// Display order for role pickers (highest privilege first).
const ROLE_ORDER: Role[] = ["super_admin", "admin", "admin_viewer", "user"]

// assignableRoles returns the roles the current caller is permitted to assign,
// mirroring backend CanAssignRole: a caller may assign role R only if they hold
// every permission R grants. `can` is the dotted-prefix predicate from useRole.
export function assignableRoles(can: (required: string) => boolean): Role[] {
  return ROLE_ORDER.filter((role) =>
    ROLE_PERMISSIONS[role].every((perm) => can(perm)),
  )
}
