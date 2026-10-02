import { describe, expect, it } from "vitest"
import { ROLE_PERMISSIONS, assignableRoles } from "./assignableRoles"
import type { Role } from "./useRole"

function canOf(role: Role) {
  const held = ROLE_PERMISSIONS[role]
  return (required: string) => held.some((h) => h === "*" || h === required || required.startsWith(h + "."))
}

describe("assignableRoles", () => {
  it("lets a super_admin assign every role", () => {
    expect(assignableRoles(canOf("super_admin"), "super_admin", "user")).toEqual(["super_admin", "admin", "admin_viewer", "user"])
  })

  it("never lets an admin invite or create admin or above", () => {
    expect(assignableRoles(canOf("admin"), "admin")).toEqual(["admin_viewer", "user"])
  })

  it("never lets an admin raise a user or viewer to admin", () => {
    expect(assignableRoles(canOf("admin"), "admin", "user")).toEqual(["admin_viewer", "user"])
    expect(assignableRoles(canOf("admin"), "admin", "admin_viewer")).toEqual(["admin_viewer", "user"])
  })

  it("lets an admin lower or keep an admin", () => {
    expect(assignableRoles(canOf("admin"), "admin", "admin")).toEqual(["admin", "admin_viewer", "user"])
  })
})
