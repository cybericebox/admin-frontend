import { describe, expect, it } from "vitest"
import { ROLE_PERMISSIONS, assignableRoles, canManageAccount } from "./assignableRoles"
import type { Role } from "./useRole"

function canOf(role: Role) {
  const held = ROLE_PERMISSIONS[role]
  return (required: string) => held.some((h) => h === "*" || h === required || required.startsWith(h + "."))
}

describe("assignableRoles", () => {
  it("lets a super_admin assign every role", () => {
    expect(assignableRoles(canOf("super_admin"), "super_admin", "user")).toEqual(["super_admin", "admin", "admin_viewer", "user"])
    expect(assignableRoles(canOf("super_admin"), "super_admin")).toEqual(["super_admin", "admin", "admin_viewer", "user"])
  })

  it("lets an admin invite and keep only users", () => {
    expect(assignableRoles(canOf("admin"), "admin")).toEqual(["user"])
    expect(assignableRoles(canOf("admin"), "admin", "user")).toEqual(["user"])
  })

  it("gives an admin no role for an account of its own level or above", () => {
    for (const current of ["admin", "admin_viewer", "super_admin"] as const) expect(assignableRoles(canOf("admin"), "admin", current)).toEqual([])
  })
})

describe("canManageAccount", () => {
  it("lets only a higher role manage a role; admin and admin_viewer are one level", () => {
    const roles: Role[] = ["super_admin", "admin", "admin_viewer", "user"]
    const expected: Record<Role, Role[]> = { super_admin: roles, admin: ["user"], admin_viewer: ["user"], user: [] }
    for (const caller of roles) for (const target of roles) expect(canManageAccount(caller, target), `${caller}->${target}`).toBe(expected[caller].includes(target))
    expect(canManageAccount("admin", "unknown")).toBe(false)
    expect(canManageAccount(null, "user")).toBe(false)
  })
})
