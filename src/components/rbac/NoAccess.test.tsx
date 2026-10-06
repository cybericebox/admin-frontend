import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("@/i18n/t", () => ({ t: (key: string) => key }))

import { NoAccess } from "./NoAccess"

describe("NoAccess", () => {
  it("shows the title and the one line", () => {
    render(<NoAccess />)
    expect(screen.getByRole("heading", { name: "admin.noAccess.title" })).toBeInTheDocument()
    expect(screen.getByText("admin.noAccess.body")).toBeInTheDocument()
  })

  it("takes a context line instead of the default one", () => {
    render(<NoAccess message="custom line" />)
    expect(screen.getByText("custom line")).toBeInTheDocument()
    expect(screen.queryByText("admin.noAccess.body")).not.toBeInTheDocument()
  })
})
