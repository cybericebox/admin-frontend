import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { RoleBadge } from "./RoleStatusBadge"

vi.mock("@/i18n/t", () => ({ t: (key: string) => key }))

describe("RoleBadge", () => {
  it("uses one visual style for every platform role", () => {
    const classes = ["super_admin", "admin", "admin_viewer", "user"].map((role) => {
      const { unmount } = render(<RoleBadge role={role} />)
      const value = screen.getByText(`role.${role}`).className
      unmount()
      return value
    })
    expect(new Set(classes).size).toBe(1)
  })
})
