import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import type { MailFooter } from "@/api/mail/settings"

vi.mock("@/api/mail/settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/mail/settings")>()),
  previewMailFooter: () => Promise.resolve({ HTML: "<p>x</p>", Text: "" }),
}))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: () => true }) }))

import { MailFooterCard } from "./MailFooterCard"

const FOOTER: MailFooter = {
  Content: null,
  DefaultContent: {
    root: {
      type: "root", version: 1, direction: "ltr", format: "", indent: 0,
      children: [{ type: "paragraph", version: 1, direction: "ltr", format: "", indent: 0, children: [{ type: "variable", version: 1, varName: "platform_name" }] }],
    },
  },
  Variables: ["platform_name", "site_url", "privacy_url", "reply_to"],
}

// The real Lexical editor of the email body text, mounted with the footer document.
describe("MailFooterCard with the real editor", () => {
  it("mounts the rich text editor with its formatting toolbar and shows the default footer variable", async () => {
    render(<MailFooterCard footer={FOOTER} canWrite onSaved={() => {}} />)
    const editor = screen.getByTestId("mail-footer-editor")
    expect(editor.querySelector("[contenteditable]")).not.toBeNull()
    expect(editor.querySelectorAll("button").length).toBeGreaterThan(1)
    expect(await screen.findByText("platform_name")).toBeInTheDocument()
  })

  it("has no toolbar when read-only", () => {
    render(<MailFooterCard footer={FOOTER} canWrite={false} onSaved={() => {}} />)
    expect(screen.getByTestId("mail-footer-editor").querySelectorAll("button").length).toBe(1)
  })
})
