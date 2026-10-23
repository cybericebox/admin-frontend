import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { ApiError } from "@/api/client"
import { BroadcastTemplatesList } from "./BroadcastTemplatesList"
import { BroadcastTemplateEditor } from "./BroadcastTemplateEditor"
import { templateInput, templateMessage } from "./broadcastMessage"

const api = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), replace: vi.fn() }))
vi.mock("@/api/notifications/broadcastTemplates", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/notifications/broadcastTemplates")>()),
  listBroadcastTemplates: api.list, getBroadcastTemplate: api.get, createBroadcastTemplate: api.create, updateBroadcastTemplate: api.update, deleteBroadcastTemplate: api.remove,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: api.replace }), usePathname: () => "/notifications/broadcast-templates" }))
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
    ID: id, ScopeEventID: null, Name: `Шаблон ${id}`, Channels: ["email"], Subject: `Тема ${id}`, Preheader: "", EmailBody: [{ type: "rich_text", content: {} }], EmailStyling: {},
    InAppTitle: "", InAppBody: "", InAppLink: "", UpdatedBy: null, UpdatedByName: "Олена Коваленко", CreatedAt: "2026-10-01T00:00:00Z", UpdatedAt: "2026-10-02T00:00:00Z", ...patch,
  }
}

beforeEach(() => { Object.values(api).forEach((fn) => fn.mockReset()) })

describe("broadcast templates list", () => {
  it("lists the templates and deletes one after a danger confirmation", async () => {
    api.list.mockResolvedValue([template("a"), template("b", { Channels: ["in_app"], Subject: "", InAppTitle: "Заголовок b" })])
    api.remove.mockResolvedValue({})
    render(<BroadcastTemplatesList />)
    expect(await screen.findByRole("link", { name: "Шаблон a" })).toHaveAttribute("href", "/notifications/broadcast-templates/edit?id=a")
    expect(screen.getByText("Тема a")).toBeInTheDocument()
    expect(screen.getByText("Заголовок b")).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole("button", { name: "Видалити шаблон" })[0])
    const dialog = await screen.findByRole("dialog")
    expect(dialog).toHaveTextContent("Шаблон «Шаблон a» зникне")
    expect(within(dialog).getByRole("button", { name: "Скасувати" })).toHaveFocus()
    fireEvent.click(within(dialog).getByRole("button", { name: "Видалити" }))
    await waitFor(() => expect(screen.queryByRole("link", { name: "Шаблон a" })).not.toBeInTheDocument())
    expect(api.remove).toHaveBeenCalledWith("a")
    expect(screen.getByRole("link", { name: "Шаблон b" })).toBeInTheDocument()
  })

  it("shows the empty state and a load error with a retry", async () => {
    api.list.mockResolvedValueOnce([])
    const view = render(<BroadcastTemplatesList />)
    expect(await screen.findByText("Збережених шаблонів ще немає")).toBeInTheDocument()
    view.unmount()
    api.list.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce([template("c")])
    render(<BroadcastTemplatesList />)
    fireEvent.click(await screen.findByRole("button", { name: "Спробувати ще раз" }))
    expect(await screen.findByRole("link", { name: "Шаблон c" })).toBeInTheDocument()
  })
})

describe("broadcast template editor", () => {
  it("keeps the name error beside the field and creates the template from the composer fields", async () => {
    api.create.mockResolvedValue(template("new1", { Name: "Старт" }))
    render(<BroadcastTemplateEditor id="" />)
    fireEvent.click(screen.getByRole("checkbox", { name: "У застосунку" }))
    fireEvent.change(screen.getByLabelText("Тема"), { target: { value: "Старт о 10:00" } })
    fireEvent.click(screen.getByRole("button", { name: "add-block" }))
    fireEvent.click(screen.getByRole("button", { name: "Зберегти" }))
    const name = screen.getByRole("textbox", { name: "Назва шаблону" })
    expect(name).toHaveAttribute("aria-invalid", "true")
    expect(document.getElementById(name.getAttribute("aria-describedby")!)).toHaveTextContent("Вкажіть назву шаблону.")
    expect(api.create).not.toHaveBeenCalled()
    fireEvent.change(name, { target: { value: " Старт " } })
    fireEvent.click(screen.getByRole("button", { name: "Зберегти" }))
    await waitFor(() => expect(api.replace).toHaveBeenCalledWith("/notifications/broadcast-templates/edit?id=new1"))
    expect(api.create).toHaveBeenCalledWith({ Name: "Старт", Channels: ["email"], Subject: "Старт о 10:00", Preheader: "", EmailBody: [{ type: "rich_text", content: {} }], EmailStyling: {}, InAppTitle: "", InAppBody: "", InAppLink: "" })
  })

  it("loads a template, saves the edit in place and shows a taken name beside the field", async () => {
    api.get.mockResolvedValue(template("t1"))
    api.update.mockRejectedValueOnce(new ApiError(409, null, "taken", undefined, 70228)).mockResolvedValueOnce(template("t1", { Name: "Інша назва" }))
    render(<BroadcastTemplateEditor id="t1" />)
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

  it("shows a load error with a retry", async () => {
    api.get.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(template("t2"))
    render(<BroadcastTemplateEditor id="t2" />)
    fireEvent.click(await screen.findByRole("button", { name: "Спробувати ще раз" }))
    expect(await screen.findByRole("textbox", { name: "Назва шаблону" })).toHaveValue("Шаблон t2")
  })
})

describe("broadcast message model", () => {
  it("keeps exactly the template's channels and saves only their parts", () => {
    const message = templateMessage(template("m", { Channels: ["in_app"], Subject: "старе", InAppTitle: "Привіт" }) as never)
    expect(message.email).toBe(false)
    expect(message.inApp).toBe(true)
    expect(templateInput("  Назва ", message)).toEqual({ Name: "Назва", Channels: ["in_app"], Subject: "", Preheader: "", EmailBody: [], EmailStyling: {}, InAppTitle: "Привіт", InAppBody: "", InAppLink: "" })
  })
})
