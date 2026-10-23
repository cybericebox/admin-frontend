import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { BroadcastCompose } from "./BroadcastCompose"

const api = vi.hoisted(() => ({ count: vi.fn(), send: vi.fn(), push: vi.fn(), emails: vi.fn(), inApps: vi.fn(), saved: vi.fn(), createTemplate: vi.fn() }))
vi.mock("@/api/notifications/broadcastTemplates", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/notifications/broadcastTemplates")>()),
  listBroadcastTemplates: api.saved, createBroadcastTemplate: api.createTemplate,
}))
vi.mock("@/api/notifications/broadcasts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/notifications/broadcasts")>()),
  broadcastAudienceCount: api.count, sendBroadcast: api.send,
}))
vi.mock("@/api/notifications/emailTemplates", () => ({ latestEmailTemplates: api.emails }))
vi.mock("@/api/notifications/inAppTemplates", () => ({ latestInAppTemplates: api.inApps }))
// The dropdown itself is covered elsewhere; here every option is a plain button.
vi.mock("@/components/ui/select-menu", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/components/ui/select-menu")>()
  return {
    SelectMenu: (props: React.ComponentProps<typeof original.SelectMenu>) => props.ariaLabel === "Почати з шаблону"
      ? <div aria-label={props.ariaLabel}>{props.options.map((o) => <button key={o.value} type="button" onClick={() => props.onChange(o.value)}>{`tpl:${o.label}`}</button>)}</div>
      : <original.SelectMenu {...props} />,
  }
})
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: api.push }) }))
// The editors and previews are covered by their own tests; here they are plain stand-ins.
vi.mock("@/components/notifications/editor/VariableRichText", () => ({
  VariableRichText: ({ value, onChange, placeholder, error }: { value: string; onChange: (v: string) => void; placeholder?: string; error?: string }) => <><input aria-label={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />{error && <p>{error}</p>}</>,
}))
vi.mock("@/components/notifications/editor/BlockEditor", () => ({
  BlockEditor: ({ onChange, hiddenBlockTypes }: { onChange: (b: unknown[]) => void; hiddenBlockTypes?: string[] }) => <button type="button" data-hidden={(hiddenBlockTypes ?? []).join(",")} onClick={() => onChange([{ type: "rich_text", content: {} }])}>add-block</button>,
}))
vi.mock("@/components/notifications/editor/InAppBodyEditor", () => ({ InAppBodyEditor: () => null }))
vi.mock("@/components/notifications/editor/EmailPreview", () => ({ EmailPreview: ({ notificationType, subject, body }: { notificationType: string; subject?: string; body?: unknown }) => <div data-testid="email-preview" data-subject={subject} data-body={JSON.stringify(body)}>{notificationType}</div> }))
vi.mock("@/components/notifications/editor/InAppPreview", () => ({ InAppPreview: () => <div data-testid="inapp-preview" /> }))
vi.mock("./UserPicker", () => ({ UserPicker: () => null }))

const wait = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 500)) })

describe("broadcast compose", () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset())
    api.count.mockResolvedValue({ Count: 3 })
    api.send.mockResolvedValue({ ID: "bc1" })
    api.saved.mockResolvedValue([])
    api.emails.mockResolvedValue([
      { NotificationType: "participant.event.finished", Draft: null, Unpublished: null, Published: { Subject: "Привіт, {{.user_name}} {{.team_name}}", Preheader: "", Body: [{ type: "rich_text", content: "Про {{event_name}} і {{team_name}}" }] } },
      { NotificationType: "draft.only", Published: null, Draft: { Subject: "x", Preheader: "", Body: [] }, Unpublished: null },
    ])
    api.inApps.mockResolvedValue([
      { NotificationType: "participant.event.finished", Draft: null, Unpublished: null, Published: { Title: "Кінець", Body: "Дякуємо, {{user_name}}", Link: "" } },
    ])
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
    expect(screen.getByRole("tab", { name: "Лист" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getAllByRole("tab")).toHaveLength(3)
    await wait()
  })

  it("fetches and shows the audience count before sending", async () => {
    render(<BroadcastCompose />)
    expect(await screen.findByText("Отримувачів: 3")).toBeInTheDocument()
    expect(api.count).toHaveBeenCalledWith({ Kind: "all" }, expect.anything())
  })

  it("opens without «required» errors and shows one only after a field was edited empty", async () => {
    render(<BroadcastCompose />)
    await screen.findByText("Отримувачів: 3")
    expect(screen.queryByText("Заповніть це поле.")).not.toBeInTheDocument()
    expect(screen.queryByText("Оберіть хоча б один канал.")).not.toBeInTheDocument()
    const subject = screen.getByLabelText("Тема")
    fireEvent.change(subject, { target: { value: "x" } })
    fireEvent.change(subject, { target: { value: "" } })
    expect(await screen.findByText("Заповніть це поле.")).toBeInTheDocument()
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

  describe("start from a template", () => {
    const pick = async () => { fireEvent.click(await screen.findByRole("button", { name: /^tpl:/ })) }

    it("lists only published templates, one entry per notification type", async () => {
      render(<BroadcastCompose />)
      expect(await screen.findAllByRole("button", { name: /^tpl:/ })).toHaveLength(1)
      await wait()
    })

    it("prefills the email subject, blocks and the in-app fields without a confirmation on an empty composer", async () => {
      render(<BroadcastCompose />)
      await pick()
      expect(screen.getByLabelText("Тема")).toHaveValue("Привіт, {{.user_name}} {{.team_name}}")
      expect(screen.getByLabelText("Заголовок")).toHaveValue("Кінець")
      expect(screen.getByTestId("email-preview").getAttribute("data-body")).toContain("Про {{event_name}} і ")
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
      await wait()
    })

    it("warns about a variable a broadcast cannot fill and previews it empty", async () => {
      render(<BroadcastCompose />)
      await pick()
      expect(screen.getByText("Змінні team_name недоступні в розсилці — їхні значення будуть порожніми.")).toBeInTheDocument()
      expect(screen.queryByText(/Змінна user_name недоступна/)).not.toBeInTheDocument()
      const preview = screen.getByTestId("email-preview")
      expect(preview.getAttribute("data-subject")).toBe("Привіт, {{.user_name}} ")
      expect(preview.getAttribute("data-body")).not.toContain("team_name")
      await wait()
    })

    it("groups all unavailable names into one warning", async () => {
      api.emails.mockResolvedValueOnce([{ NotificationType: "team.invite", Published: { Subject: "{{.team_name}} {{.invite_url}}", Preheader: "", Body: [{ type: "rich_text", content: "{{team_url}} {{team_name}}" }] } }])
      api.inApps.mockResolvedValueOnce([])
      render(<BroadcastCompose />)
      await pick()
      const warning = screen.getByRole("alert")
      expect(warning).toHaveTextContent("team_name, invite_url, team_url")
      expect(warning.querySelectorAll("li")).toHaveLength(0)
      await wait()
    })

    it("includes unavailable Lexical variable nodes in the single warning", async () => {
      api.emails.mockResolvedValueOnce([{ NotificationType: "team.invite", Published: { Subject: "{{.team_name}}", Preheader: "", Body: [{ type: "rich_text", content: { root: { children: [{ type: "paragraph", children: [{ type: "variable", varName: "ghost" }] }] } } }] } }])
      api.inApps.mockResolvedValueOnce([])
      render(<BroadcastCompose />)
      await pick()
      expect(screen.getByRole("alert")).toHaveTextContent("team_name, ghost")
      await wait()
    })

    it("asks before replacing existing content, and keeps it on cancel", async () => {
      render(<BroadcastCompose />)
      fireEvent.change(screen.getByLabelText("Тема"), { target: { value: "Моя тема" } })
      await pick()
      expect(await screen.findByRole("dialog")).toBeInTheDocument()
      expect(screen.getByLabelText("Тема")).toHaveValue("Моя тема")
      fireEvent.click(screen.getByRole("button", { name: "Скасувати" }))
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
      expect(screen.getByLabelText("Тема")).toHaveValue("Моя тема")
      await pick()
      fireEvent.click(await screen.findByRole("button", { name: "Замінити" }))
      expect(screen.getByLabelText("Тема")).toHaveValue("Привіт, {{.user_name}} {{.team_name}}")
      await wait()
    })
  })

  describe("saved broadcast templates", () => {
    const savedTemplate = {
      ID: "tpl1", ScopeEventID: null, Name: "Технічні роботи", Channels: ["in_app"], Subject: "", Preheader: "", EmailBody: [], EmailStyling: {},
      InAppTitle: "Роботи о 22:00", InAppBody: "Платформа буде недоступна", InAppLink: "", UpdatedBy: null, UpdatedByName: "", CreatedAt: "2026-10-01T00:00:00Z", UpdatedAt: "2026-10-01T00:00:00Z",
    }

    it("lists the saved templates and applies one with exactly its channels", async () => {
      api.saved.mockResolvedValue([savedTemplate])
      render(<BroadcastCompose />)
      fireEvent.click(await screen.findByRole("button", { name: "tpl:Технічні роботи" }))
      expect(screen.getByRole("checkbox", { name: "Електронна пошта" })).not.toBeChecked()
      expect(screen.getByRole("checkbox", { name: "У застосунку" })).toBeChecked()
      expect(screen.getByLabelText("Заголовок")).toHaveValue("Роботи о 22:00")
      expect(screen.queryByLabelText("Тема")).not.toBeInTheDocument()
      await wait()
    })

    it("saves the message as a template without the audience; a taken name stays beside the name field", async () => {
      const { ApiError } = await import("@/api/client")
      api.createTemplate.mockRejectedValueOnce(new ApiError(409, null, "taken", undefined, 70228)).mockResolvedValueOnce({ ...savedTemplate, ID: "tpl2" })
      render(<BroadcastCompose />)
      await fillEmail()
      fireEvent.click(screen.getByRole("button", { name: /Зберегти як шаблон/ }))
      const name = await screen.findByRole("textbox", { name: "Назва шаблону" })
      fireEvent.change(name, { target: { value: "Привітання" } })
      fireEvent.click(screen.getByRole("button", { name: "Зберегти" }))
      await waitFor(() => expect(name).toHaveAttribute("aria-invalid", "true"))
      expect(document.getElementById(name.getAttribute("aria-describedby")!)).toHaveTextContent("Шаблон з такою назвою вже є. Оберіть іншу назву.")
      fireEvent.change(name, { target: { value: "Привітання 2" } })
      expect(name).not.toHaveAttribute("aria-invalid")
      fireEvent.click(screen.getByRole("button", { name: "Зберегти" }))
      await waitFor(() => expect(api.createTemplate).toHaveBeenCalledTimes(2))
      expect(api.createTemplate).toHaveBeenLastCalledWith({
        Name: "Привітання 2", Channels: ["email"], Subject: "Привіт", Preheader: "", EmailBody: [{ type: "rich_text", content: {} }], EmailStyling: {},
        InAppTitle: "", InAppBody: "", InAppLink: "",
      })
      expect(api.send).not.toHaveBeenCalled()
      await waitFor(() => expect(screen.queryByRole("textbox", { name: "Назва шаблону" })).not.toBeInTheDocument())
    })

    it("marks the empty fields instead of saving an incomplete message", async () => {
      render(<BroadcastCompose />)
      await screen.findByText("Отримувачів: 3")
      fireEvent.click(screen.getByRole("button", { name: /Зберегти як шаблон/ }))
      expect((await screen.findAllByText("Заповніть це поле.")).length).toBeGreaterThan(0)
      expect(screen.queryByRole("textbox", { name: "Назва шаблону" })).not.toBeInTheDocument()
    })
  })
})
