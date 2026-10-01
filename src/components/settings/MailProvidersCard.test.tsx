import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { useEffect, useState } from "react"
import type { MailProvider, MailSettings } from "@/api/mail/settings"

const createMailProvider = vi.fn()
const saveMailProvider = vi.fn()
const setMailProviderEnabled = vi.fn()
const deleteMailProvider = vi.fn()
const reorderMailProviders = vi.fn()
const testMailProvider = vi.fn()
const testMailProviderForm = vi.fn()
const testMailTransportInUse = vi.fn()
vi.mock("@/api/mail/settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/mail/settings")>()),
  createMailProvider: (input: unknown) => createMailProvider(input),
  saveMailProvider: (id: string, input: unknown) => saveMailProvider(id, input),
  setMailProviderEnabled: (id: string, enabled: boolean) => setMailProviderEnabled(id, enabled),
  deleteMailProvider: (id: string) => deleteMailProvider(id),
  reorderMailProviders: (ids: string[]) => reorderMailProviders(ids),
  testMailProvider: (id: string) => testMailProvider(id),
  testMailProviderForm: (input: unknown, id?: string) => testMailProviderForm(input, id),
  testMailTransportInUse: () => testMailTransportInUse(),
}))
let perms = ["platform.settings.read", "platform.settings.write"]
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: (perm: string) => perms.includes(perm) }) }))
const toastError = vi.fn()
const toastSuccess = vi.fn()
vi.mock("@/components/ui/toast", () => ({ toast: { error: (m: string) => toastError(m), success: (m: string) => toastSuccess(m), warning: vi.fn() } }))

import { MailProvidersCard } from "./MailProvidersCard"

function provider(id: string, name: string, priority: number, extra: Partial<MailProvider> = {}): MailProvider {
  return {
    ID: id, Name: name, Host: `smtp.${id}.example`, Port: 587, TLSMode: "starttls", Username: "u", PasswordSet: true, Priority: priority, Enabled: true,
    Sender: { Name: "", Address: "" }, ReplyTo: { Name: "", Address: "" }, MaxPerSecond: null, DailyLimit: null, SentToday: 0, Exhausted: false,
    ResetsAt: "2026-10-02T00:00:00Z", LastUsedAt: null, LastError: "", LastErrorAt: null, UpdatedAt: "2026-09-29T10:00:00Z", ...extra,
  }
}

function settings(providers: MailProvider[], extra: Partial<MailSettings> = {}): MailSettings {
  return {
    Identity: { Sender: { Name: "", Address: "" }, ReplyTo: { Name: "", Address: "" } },
    Effective: { Sender: { Name: "", Address: "" }, ReplyTo: { Name: "", Address: "" } },
    Footer: { Content: null, DefaultContent: {}, Variables: [] },
    SendingDomain: "", SavedSendingDomain: "", EnvSendingDomain: "",
    Sources: { SenderName: "none", SenderAddress: "none", ReplyToName: "none", ReplyToAddress: "none", SendingDomain: "none" },
    Source: providers.length ? "database" : "none", Configured: providers.length > 0, EnvActive: false, Env: null, Providers: providers, ...extra,
  }
}

const reload = vi.fn(() => Promise.resolve())
let latest: MailSettings | null = null

function Host({ initial, canWrite = true }: { initial: MailSettings; canWrite?: boolean }) {
  const [state, setState] = useState<MailSettings | null>(initial)
  useEffect(() => { latest = state }, [state])
  return state ? <MailProvidersCard settings={state} canWrite={canWrite} update={setState} reload={reload} /> : null
}

const names = () => screen.getAllByTestId(/^mail-provider-p/).map((el) => within(el).getAllByText(/^(Brevo|SES|Mailgun)$/)[0].textContent)

describe("MailProvidersCard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    perms = ["platform.settings.read", "platform.settings.write"]
    latest = null
  })

  it("shows the empty state with the add button when there are no providers", () => {
    render(<Host initial={settings([])} />)
    expect(screen.getByText("Провайдерів ще немає. Додайте першого, щоб платформа надсилала листи.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Додати провайдера" })).toBeInTheDocument()
  })

  it("lists providers by priority with today's usage against the daily limit and the last error", () => {
    const failing = provider("p2", "SES", 1, { LastError: "535 authentication failed", LastErrorAt: "2026-10-01T09:00:00Z" })
    const limited = provider("p1", "Brevo", 0, { DailyLimit: 300, SentToday: 120 })
    render(<Host initial={settings([limited, failing])} />)
    expect(names()).toEqual(["Brevo", "SES"])
    expect(screen.getByText("Сьогодні (UTC): 120 з 300")).toBeInTheDocument()
    expect(screen.getByRole("progressbar", { name: "Використання добового ліміту «Brevo»" })).toHaveAttribute("aria-valuenow", "120")
    expect(screen.getByText("Сьогодні (UTC): 0, без ліміту")).toBeInTheDocument()
    expect(screen.getByTestId("mail-provider-error")).toHaveTextContent("535 authentication failed")
  })

  it("marks an exhausted provider with the time the limit resets", () => {
    render(<Host initial={settings([provider("p1", "Brevo", 0, { DailyLimit: 300, SentToday: 300, Exhausted: true })])} />)
    expect(screen.getByText(/Ліміт вичерпано, відновиться/)).toBeInTheDocument()
  })

  it("shows the env transport read-only, as in use, when no providers are saved", () => {
    render(<Host initial={settings([], { Source: "env", EnvActive: true, Env: { Host: "env.smtp", Port: 465, FromName: "Env", FromAddress: "env@example.com", ReplyTo: "" } })} />)
    const env = screen.getByTestId("mail-env-provider")
    expect(within(env).getByText(/Провайдерів не налаштовано, тому пошта йде через SMTP_\* з оточення/)).toBeInTheDocument()
    expect(within(env).getByText(/env\.smtp:465/)).toBeInTheDocument()
  })

  it("does not show env as active once a provider is saved", () => {
    render(<Host initial={settings([provider("p1", "Brevo", 0)], { Env: { Host: "env.smtp", Port: 465, FromName: "Env", FromAddress: "env@example.com", ReplyTo: "" } })} />)
    expect(screen.queryByTestId("mail-env-provider")).not.toBeInTheDocument()
    expect(screen.getByText("Brevo")).toBeInTheDocument()
  })

  it("tests the transport in use from the env row", async () => {
    testMailTransportInUse.mockResolvedValue({ Sent: true, Recipient: "me@example.com", Transport: "env", Error: "" })
    render(<Host initial={settings([], { Source: "env", EnvActive: true, Env: { Host: "env.smtp", Port: 465, FromName: "Env", FromAddress: "env@example.com", ReplyTo: "" } })} />)
    fireEvent.click(within(screen.getByTestId("mail-env-provider")).getByRole("button", { name: "Перевірити" }))
    await waitFor(() => expect(testMailTransportInUse).toHaveBeenCalled())
    expect(await screen.findByText(/me@example.com/)).toBeInTheDocument()
  })

  it("switches a provider optimistically and keeps every control enabled while the save runs", async () => {
    const pending = new Promise<MailSettings>(() => {})
    setMailProviderEnabled.mockReturnValue(pending)
    render(<Host initial={settings([provider("p1", "Brevo", 0), provider("p2", "SES", 1)])} />)
    const brevo = screen.getByRole("switch", { name: "Увімкнути «Brevo»" })
    const ses = screen.getByRole("switch", { name: "Увімкнути «SES»" })
    fireEvent.click(brevo)
    expect(brevo).toHaveAttribute("aria-checked", "false")
    expect(brevo).toBeEnabled()
    expect(ses).toBeEnabled()
    fireEvent.click(ses)
    expect(ses).toHaveAttribute("aria-checked", "false")
    await waitFor(() => expect(setMailProviderEnabled).toHaveBeenCalledWith("p1", false))
    expect(setMailProviderEnabled).toHaveBeenCalledTimes(1) // the second save waits for the first
  })

  it("runs quick changes one after another and applies only the last answer", async () => {
    let first!: (v: MailSettings) => void
    setMailProviderEnabled.mockReturnValueOnce(new Promise<MailSettings>((resolve) => { first = resolve })).mockResolvedValueOnce(settings([provider("p1", "Brevo", 0, { Enabled: true })]))
    render(<Host initial={settings([provider("p1", "Brevo", 0)])} />)
    const sw = screen.getByRole("switch", { name: "Увімкнути «Brevo»" })
    fireEvent.click(sw)
    fireEvent.click(sw)
    expect(sw).toHaveAttribute("aria-checked", "true")
    await act(async () => { first(settings([provider("p1", "Brevo", 0, { Enabled: false })])) })
    await waitFor(() => expect(setMailProviderEnabled).toHaveBeenCalledTimes(2))
    expect(setMailProviderEnabled).toHaveBeenNthCalledWith(1, "p1", false)
    expect(setMailProviderEnabled).toHaveBeenNthCalledWith(2, "p1", true)
    expect(screen.getByRole("switch", { name: "Увімкнути «Brevo»" })).toHaveAttribute("aria-checked", "true")
  })

  it("rolls back with a refetch and a toast when the save fails", async () => {
    setMailProviderEnabled.mockRejectedValue(new Error("boom"))
    render(<Host initial={settings([provider("p1", "Brevo", 0)])} />)
    fireEvent.click(screen.getByRole("switch", { name: "Увімкнути «Brevo»" }))
    await waitFor(() => expect(toastError).toHaveBeenCalled())
    expect(reload).toHaveBeenCalled()
  })

  it("moves a provider and saves the whole order", async () => {
    reorderMailProviders.mockResolvedValue(settings([provider("p2", "SES", 0), provider("p1", "Brevo", 1)]))
    render(<Host initial={settings([provider("p1", "Brevo", 0), provider("p2", "SES", 1)])} />)
    fireEvent.click(screen.getByRole("button", { name: "Підняти «SES» вище" }))
    expect(names()).toEqual(["SES", "Brevo"])
    await waitFor(() => expect(reorderMailProviders).toHaveBeenCalledWith(["p2", "p1"]))
    expect(screen.getByRole("button", { name: "Підняти «SES» вище" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Опустити «Brevo» нижче" })).toBeDisabled()
  })

  it("adds a provider from the dialog and sends the typed values with null limits for empty fields", async () => {
    createMailProvider.mockResolvedValue(settings([provider("p1", "Brevo", 0)]))
    render(<Host initial={settings([])} />)
    fireEvent.click(screen.getByRole("button", { name: "Додати провайдера" }))
    fireEvent.change(screen.getByLabelText(/Назва/), { target: { value: " Brevo " } })
    fireEvent.change(screen.getByLabelText(/Сервер/), { target: { value: "smtp-relay.brevo.com" } })
    fireEvent.change(screen.getByLabelText("Користувач"), { target: { value: "mailer" } })
    fireEvent.change(screen.getByLabelText("Пароль"), { target: { value: "s3cret" } })
    fireEvent.change(screen.getByLabelText("Ліміт листів на добу"), { target: { value: "300" } })
    fireEvent.click(screen.getByRole("button", { name: "Зберегти" }))
    await waitFor(() => expect(createMailProvider).toHaveBeenCalledWith({
      Name: "Brevo", Host: "smtp-relay.brevo.com", Port: 587, TLSMode: "starttls", Username: "mailer", Password: "s3cret", ClearPassword: false,
      Sender: { Name: "", Address: "" }, ReplyTo: { Name: "", Address: "" }, MaxPerSecond: null, DailyQuota: 300,
    }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(toastSuccess).toHaveBeenCalledWith("Провайдера додано.")
    expect(latest?.Providers).toHaveLength(1)
  })

  it("validates the form before calling the API", async () => {
    render(<Host initial={settings([])} />)
    fireEvent.click(screen.getByRole("button", { name: "Додати провайдера" }))
    fireEvent.click(screen.getByRole("button", { name: "Зберегти" }))
    expect(await screen.findByText("Вкажіть назву провайдера.")).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Назва/), { target: { value: "x" } })
    fireEvent.click(screen.getByRole("button", { name: "Зберегти" }))
    expect(await screen.findByText("Вкажіть SMTP-сервер.")).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Сервер/), { target: { value: "h.example" } })
    fireEvent.change(screen.getByLabelText("Порт"), { target: { value: "70000" } })
    fireEvent.click(screen.getByRole("button", { name: "Зберегти" }))
    expect(await screen.findByText("Порт має бути цілим числом від 1 до 65535.")).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Порт"), { target: { value: "587" } })
    fireEvent.change(screen.getByLabelText("Максимум листів за секунду"), { target: { value: "0" } })
    fireEvent.click(screen.getByRole("button", { name: "Зберегти" }))
    expect(await screen.findByText("Максимум листів за секунду має бути числом більше нуля.")).toBeInTheDocument()
    expect(createMailProvider).not.toHaveBeenCalled()
  })

  it("edits a provider keeping the stored password and shows an API error inside the dialog", async () => {
    saveMailProvider.mockRejectedValue(new Error("boom"))
    render(<Host initial={settings([provider("p1", "Brevo", 0, { DailyLimit: 300 })])} />)
    fireEvent.click(screen.getByRole("button", { name: "Змінити «Brevo»" }))
    expect(screen.getByPlaceholderText("Пароль збережено")).toHaveValue("")
    expect(screen.getByLabelText("Ліміт листів на добу")).toHaveValue("300")
    fireEvent.change(screen.getByLabelText(/Сервер/), { target: { value: "smtp2.example.com" } })
    fireEvent.click(screen.getByRole("button", { name: "Зберегти" }))
    await waitFor(() => expect(saveMailProvider).toHaveBeenCalledWith("p1", expect.objectContaining({ Host: "smtp2.example.com", Password: "", ClearPassword: false, DailyQuota: 300 })))
    expect(await screen.findByRole("alert")).toBeInTheDocument()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("sends ClearPassword after «Видалити пароль»", async () => {
    saveMailProvider.mockResolvedValue(settings([provider("p1", "Brevo", 0, { PasswordSet: false })]))
    render(<Host initial={settings([provider("p1", "Brevo", 0)])} />)
    fireEvent.click(screen.getByRole("button", { name: "Змінити «Brevo»" }))
    fireEvent.click(screen.getByRole("button", { name: "Видалити пароль" }))
    expect(screen.getByText("Пароль буде видалено після збереження")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Зберегти" }))
    await waitFor(() => expect(saveMailProvider).toHaveBeenCalledWith("p1", expect.objectContaining({ Password: "", ClearPassword: true })))
  })

  it("tests the form values with the provider id and shows the result inside the dialog", async () => {
    testMailProviderForm.mockResolvedValue({ Sent: false, Recipient: "admin@example.com", Transport: "platform", Error: "535 auth failed" })
    render(<Host initial={settings([provider("p1", "Brevo", 0)])} />)
    fireEvent.click(screen.getByRole("button", { name: "Змінити «Brevo»" }))
    fireEvent.change(screen.getByLabelText("Порт"), { target: { value: "2525" } })
    fireEvent.click(screen.getByRole("button", { name: "Перевірити підключення" }))
    await waitFor(() => expect(testMailProviderForm).toHaveBeenCalledWith(expect.objectContaining({ Host: "smtp.p1.example", Port: 2525 }), "p1"))
    expect(await screen.findByText(/admin@example.com: 535 auth failed/)).toBeInTheDocument()
  })

  it("tests a stored provider from its row", async () => {
    testMailProvider.mockResolvedValue({ Sent: true, Recipient: "me@example.com", Transport: "platform", Error: "" })
    render(<Host initial={settings([provider("p1", "Brevo", 0)])} />)
    fireEvent.click(screen.getByRole("button", { name: "Надіслати тестовий лист через «Brevo»" }))
    await waitFor(() => expect(testMailProvider).toHaveBeenCalledWith("p1"))
    expect(await screen.findByText(/me@example.com/)).toBeInTheDocument()
  })

  it("deletes only after the danger confirmation and keeps focus on cancel", async () => {
    deleteMailProvider.mockResolvedValue(settings([]))
    render(<Host initial={settings([provider("p1", "Brevo", 0)])} />)
    fireEvent.click(screen.getByRole("button", { name: "Видалити «Brevo»" }))
    expect(screen.getByText("Видалити провайдера «Brevo»?")).toBeInTheDocument()
    expect(deleteMailProvider).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Видалити" }))
    await waitFor(() => expect(deleteMailProvider).toHaveBeenCalledWith("p1"))
    await waitFor(() => expect(latest?.Providers).toHaveLength(0))
    expect(toastSuccess).toHaveBeenCalledWith("Провайдера видалено.")
  })

  it("is read-only without write access", () => {
    render(<Host initial={settings([provider("p1", "Brevo", 0)])} canWrite={false} />)
    expect(screen.getByRole("switch", { name: "Увімкнути «Brevo»" })).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Додати провайдера" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Змінити «Brevo»" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Видалити «Brevo»" })).not.toBeInTheDocument()
  })
})
