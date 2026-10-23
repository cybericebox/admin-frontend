import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { ApiError } from "@/api/client"
import { CustomTemplateEditor } from "./CustomTemplateEditor"
import { templateInput, templateMessage } from "@/components/notifications/broadcast/broadcastMessage"

const api = vi.hoisted(() => ({ get: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), replace: vi.fn(), push: vi.fn() }))
vi.mock("@/api/notifications/broadcastTemplates", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/notifications/broadcastTemplates")>()),
  getBroadcastTemplate: api.get, createBroadcastTemplate: api.create, updateBroadcastTemplate: api.update, deleteBroadcastTemplate: api.remove,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: api.push, replace: api.replace }), usePathname: () => "/notifications/templates/custom" }))
// The editors and previews are covered by their own tests; here they are plain stand-ins.
vi.mock("@/components/notifications/editor/VariableRichText", () => ({
  VariableRichText: ({ value, onChange, placeholder, error }: { value: string; onChange: (v: string) => void; placeholder?: string; error?: string }) => <><input aria-label={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />{error && <p>{error}</p>}</>,
}))
vi.mock("@/components/notifications/editor/BlockEditor", () => ({
  BlockEditor: ({ onChange }: { onChange: (b: unknown[]) => void }) => <button type="button" onClick={() => onChange([{ type: "rich_text", content: {} }])}>add-block</button>,
}))
vi.mock("@/components/notifications/editor/InAppBodyEditor", () => ({
  InAppBodyEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => <textarea aria-label="in-app body" value={value} onChange={(e) => onChange(e.target.value)} />,
}))
vi.mock("@/components/notifications/editor/EmailPreview", () => ({ EmailPreview: () => <div data-testid="email-preview" /> }))
vi.mock("@/components/notifications/editor/InAppPreview", () => ({ InAppPreview: () => <div data-testid="inapp-preview" /> }))

function template(id: string, patch: Record<string, unknown> = {}) {
  return {
    Kind: "custom", ID: id, ScopeEventID: null, Name: `Шаблон ${id}`, Channels: ["email"], Subject: `Тема ${id}`, Preheader: "", EmailBody: [{ type: "rich_text", content: {} }], EmailStyling: {},
    InAppTitle: "", InAppBody: "", InAppLink: "", UpdatedBy: null, UpdatedByName: "Олена Коваленко", CreatedAt: "2026-10-01T00:00:00Z", UpdatedAt: "2026-10-02T00:00:00Z", ...patch,
  }
}

beforeEach(() => { Object.values(api).forEach((fn) => fn.mockReset()) })

describe("custom template editor", () => {
  it("starts on the page's channel and creates the template from the broadcast fields", async () => {
    api.create.mockResolvedValue(template("new1", { Name: "Старт" }))
    render(<CustomTemplateEditor id="" channel="email" />)
    expect(screen.getByRole("checkbox", { name: "Електронна пошта" })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: "У застосунку" })).not.toBeChecked()
    fireEvent.change(screen.getByLabelText("Тема"), { target: { value: "Старт о 10:00" } })
    fireEvent.click(screen.getByRole("button", { name: "add-block" }))
    fireEvent.click(screen.getByRole("button", { name: "Зберегти" }))
    const name = screen.getByRole("textbox", { name: "Назва шаблону" })
    expect(name).toHaveAttribute("aria-invalid", "true")
    expect(document.getElementById(name.getAttribute("aria-describedby")!)).toHaveTextContent("Вкажіть назву шаблону.")
    expect(api.create).not.toHaveBeenCalled()
    fireEvent.change(name, { target: { value: " Старт " } })
    fireEvent.click(screen.getByRole("button", { name: "Зберегти" }))
    await waitFor(() => expect(api.replace).toHaveBeenCalledWith("/notifications/templates/custom?channel=email&id=new1"))
    expect(api.create).toHaveBeenCalledWith({ Name: "Старт", Channels: ["email"], Subject: "Старт о 10:00", Preheader: "", EmailBody: [{ type: "rich_text", content: {} }], EmailStyling: {}, InAppTitle: "", InAppBody: "", InAppLink: "" })
  })

  it("a new template from the in-app page starts on the in-app channel", () => {
    render(<CustomTemplateEditor id="" channel="in_app" />)
    expect(screen.getByRole("checkbox", { name: "Електронна пошта" })).not.toBeChecked()
    expect(screen.getByRole("checkbox", { name: "У застосунку" })).toBeChecked()
  })

  it("loads a template, saves the edit in place and shows a taken name beside the field", async () => {
    api.get.mockResolvedValue(template("t1"))
    api.update.mockRejectedValueOnce(new ApiError(409, null, "taken", undefined, 70228)).mockResolvedValueOnce(template("t1", { Name: "Інша назва" }))
    render(<CustomTemplateEditor id="t1" channel="email" />)
    const name = await screen.findByRole("textbox", { name: "Назва шаблону" })
    expect(name).toHaveValue("Шаблон t1")
    const save = screen.getByRole("button", { name: "Зберегти" })
    expect(save).toBeDisabled()
    fireEvent.change(name, { target: { value: "Зайнята" } })
    fireEvent.click(save)
    await waitFor(() => expect(name).toHaveAttribute("aria-invalid", "true"))
    expect(document.getElementById(name.getAttribute("aria-describedby")!)).toHaveTextContent("Шаблон з такою назвою вже є.")
    fireEvent.change(name, { target: { value: "Інша назва" } })
    expect(name).not.toHaveAttribute("aria-invalid")
    fireEvent.click(save)
    await waitFor(() => expect(screen.getByRole("heading", { name: "Інша назва" })).toBeInTheDocument())
    expect(api.update).toHaveBeenLastCalledWith("t1", expect.objectContaining({ Name: "Інша назва", Channels: ["email"], Subject: "Тема t1" }))
    expect(api.replace).not.toHaveBeenCalled()
  })

  it("deletes after a danger confirmation and returns to the templates page it came from", async () => {
    api.get.mockResolvedValue(template("t2", { Channels: ["in_app"], Subject: "", InAppTitle: "Привіт", InAppBody: "x" }))
    api.remove.mockResolvedValue({})
    render(<CustomTemplateEditor id="t2" channel="in_app" />)
    fireEvent.click(await screen.findByRole("button", { name: "Видалити" }))
    const dialog = await screen.findByRole("dialog")
    expect(dialog).toHaveTextContent("Шаблон «Шаблон t2» зникне")
    expect(within(dialog).getByRole("button", { name: "Скасувати" })).toHaveFocus()
    fireEvent.click(within(dialog).getByRole("button", { name: "Видалити" }))
    await waitFor(() => expect(api.push).toHaveBeenCalledWith("/notifications/templates/in-app"))
    expect(api.remove).toHaveBeenCalledWith("t2")
  })

  it("shows a load error with a retry", async () => {
    api.get.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(template("t3"))
    render(<CustomTemplateEditor id="t3" channel="email" />)
    fireEvent.click(await screen.findByRole("button", { name: "Спробувати ще раз" }))
    expect(await screen.findByRole("textbox", { name: "Назва шаблону" })).toHaveValue("Шаблон t3")
  })
})

describe("custom template model", () => {
  it("keeps exactly the template's channels and saves only their parts", () => {
    const message = templateMessage(template("m", { Channels: ["in_app"], Subject: "старе", InAppTitle: "Привіт" }) as never)
    expect(message.email).toBe(false)
    expect(message.inApp).toBe(true)
    expect(templateInput("  Назва ", message)).toEqual({ Name: "Назва", Channels: ["in_app"], Subject: "", Preheader: "", EmailBody: [], EmailStyling: {}, InAppTitle: "Привіт", InAppBody: "", InAppLink: "" })
  })
})
