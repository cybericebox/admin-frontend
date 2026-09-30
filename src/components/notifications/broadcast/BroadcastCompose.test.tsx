import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { BroadcastCompose } from "./BroadcastCompose"

const api = vi.hoisted(() => ({ count: vi.fn(), send: vi.fn(), push: vi.fn() }))
vi.mock("@/api/notifications/broadcasts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/notifications/broadcasts")>()),
  broadcastAudienceCount: api.count, sendBroadcast: api.send,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: api.push }) }))
// The editors and previews are covered by their own tests; here they are plain stand-ins.
vi.mock("@/components/notifications/editor/VariableRichText", () => ({
  VariableRichText: ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) => <input aria-label={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />,
}))
vi.mock("@/components/notifications/editor/BlockEditor", () => ({
  BlockEditor: ({ onChange, hiddenBlockTypes }: { onChange: (b: unknown[]) => void; hiddenBlockTypes?: string[] }) => <button type="button" data-hidden={(hiddenBlockTypes ?? []).join(",")} onClick={() => onChange([{ type: "rich_text", content: {} }])}>add-block</button>,
}))
vi.mock("@/components/notifications/editor/InAppBodyEditor", () => ({ InAppBodyEditor: () => null }))
vi.mock("@/components/notifications/editor/EmailPreview", () => ({ EmailPreview: ({ notificationType }: { notificationType: string }) => <div data-testid="email-preview">{notificationType}</div> }))
vi.mock("@/components/notifications/editor/InAppPreview", () => ({ InAppPreview: () => <div data-testid="inapp-preview" /> }))
vi.mock("./UserPicker", () => ({ UserPicker: () => null }))

const wait = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 500)) })

describe("broadcast compose", () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset())
    api.count.mockResolvedValue({ Count: 3 })
    api.send.mockResolvedValue({ ID: "bc1" })
  })

  async function fillEmail() {
    fireEvent.click(screen.getByRole("checkbox", { name: "У застосунку" }))
    fireEvent.change(screen.getByLabelText("Тема"), { target: { value: "Привіт" } })
    fireEvent.click(screen.getByRole("button", { name: "add-block" }))
    await wait()
  }

  it("previews the email as the broadcast type and hides the image block", async () => {
    render(<BroadcastCompose />)
    expect(screen.getByTestId("email-preview")).toHaveTextContent("broadcast")
    expect(screen.getByRole("button", { name: "add-block" })).toHaveAttribute("data-hidden", "image")
    expect(screen.getByTestId("inapp-preview")).toBeInTheDocument()
    await wait()
  })

  it("fetches and shows the audience count before sending", async () => {
    render(<BroadcastCompose />)
    expect(await screen.findByText("Отримувачів: 3")).toBeInTheDocument()
    expect(api.count).toHaveBeenCalledWith({ Kind: "all" }, expect.anything())
  })

  it("keeps Send disabled until the message is valid", async () => {
    render(<BroadcastCompose />)
    await screen.findByText("Отримувачів: 3")
    expect(screen.getByRole("button", { name: "Надіслати повідомлення" })).toBeDisabled()
  })

  it("confirms with the count, then sends the payload and opens the details", async () => {
    render(<BroadcastCompose />)
    await fillEmail()
    await screen.findByText("Отримувачів: 3")
    fireEvent.click(screen.getByRole("button", { name: "Надіслати повідомлення" }))
    expect(await screen.findByText("Надіслати 3 отримувачам?")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Скасувати" })).toHaveFocus()
    expect(api.send).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Надіслати" }))
    await waitFor(() => expect(api.send).toHaveBeenCalledWith(expect.objectContaining({
      Channels: ["email"], Subject: "Привіт", EmailBody: [{ type: "rich_text", content: {} }],
      InAppTitle: "", InAppBody: "", Audience: { Kind: "all" },
    })))
    await waitFor(() => expect(api.push).toHaveBeenCalledWith("/notifications/broadcasts/detail?id=bc1"))
  })

  it("shows a send error inline and stays on the page", async () => {
    api.send.mockRejectedValue(new Error("boom"))
    render(<BroadcastCompose />)
    await fillEmail()
    await screen.findByText("Отримувачів: 3")
    fireEvent.click(screen.getByRole("button", { name: "Надіслати повідомлення" }))
    fireEvent.click(await screen.findByRole("button", { name: "Надіслати" }))
    expect(await screen.findByRole("alert")).toBeInTheDocument()
    expect(api.push).not.toHaveBeenCalled()
  })

  it("asks for roles and does not request a count until one is chosen", async () => {
    render(<BroadcastCompose />)
    await screen.findByText("Отримувачів: 3")
    api.count.mockClear()
    fireEvent.pointerDown(screen.getByRole("button", { name: "Отримувачі" }), { button: 0, ctrlKey: false })
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "За роллю" }))
    expect(await screen.findByText("Оберіть отримувачів, щоб побачити їх кількість.")).toBeInTheDocument()
    await wait()
    expect(api.count).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("checkbox", { name: "Адміністратор" }))
    await waitFor(() => expect(api.count).toHaveBeenCalledWith({ Kind: "roles", Roles: ["admin"] }, expect.anything()))
  })
})
