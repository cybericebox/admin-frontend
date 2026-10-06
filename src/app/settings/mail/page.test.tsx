import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { MailProvider, MailSettings } from "@/api/mail/settings"

const getMailSettings = vi.fn()
const saveMailIdentity = vi.fn()
vi.mock("@/api/mail/settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/mail/settings")>()),
  previewMailFooter: () => Promise.resolve({ HTML: "<p>preview</p>", Text: "preview" }),
  getMailSettings: () => getMailSettings(),
  saveMailIdentity: (input: unknown) => saveMailIdentity(input),
}))
let perms = ["platform.settings.read", "platform.settings.write"]
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: (perm: string) => perms.includes(perm) }) }))
vi.mock("next/navigation", () => ({ usePathname: () => "/settings/mail" }))

import Page from "./page"

const PROVIDER: MailProvider = {
  ID: "p1", Name: "Brevo", Host: "smtp.example.com", Port: 587, TLSMode: "starttls", Username: "mailer", PasswordSet: true, Priority: 0, Enabled: true,
  Sender: { Name: "", Address: "" }, ReplyTo: { Name: "", Address: "" }, MaxPerSecond: null, DailyLimit: 300, SentToday: 120, Exhausted: false,
  ResetsAt: "2026-10-02T00:00:00Z", LastUsedAt: null, LastError: "", LastErrorAt: null, UpdatedAt: "2026-09-29T10:00:00Z",
}

const STORED: MailSettings = {
  Identity: { Sender: { Name: "CyberICEBox", Address: "notifications@mail.cybericebox.com" }, ReplyTo: { Name: "", Address: "support@cybericebox.com" } },
  Effective: { Sender: { Name: "CyberICEBox", Address: "notifications@mail.cybericebox.com" }, ReplyTo: { Name: "", Address: "support@cybericebox.com" } },
  Footer: { Content: null, DefaultContent: { root: { type: "root", children: [] } }, Variables: ["platform_name", "site_url", "privacy_url", "reply_to"] },
  SendingDomain: "mail.cybericebox.com",
  SavedSendingDomain: "mail.cybericebox.com",
  EnvSendingDomain: "cybericebox.com",
  Sources: { SenderName: "saved", SenderAddress: "saved", ReplyToName: "none", ReplyToAddress: "saved", SendingDomain: "saved" },
  Source: "database",
  Configured: true,
  EnvActive: false,
  Env: null,
  Providers: [PROVIDER],
}

describe("mail settings page", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    perms = ["platform.settings.read", "platform.settings.write"]
  })

  it("shows the sender section and the providers list", async () => {
    getMailSettings.mockResolvedValue(STORED)
    render(<Page />)
    expect(await screen.findByText("SMTP-провайдери")).toBeInTheDocument()
    expect(screen.getByLabelText("Домен відправлення")).toHaveValue("mail.cybericebox.com")
    expect(screen.getByText("Brevo")).toBeInTheDocument()
  })

  it("shows a load error with a retry that reloads", async () => {
    getMailSettings.mockRejectedValueOnce(new Error("boom")).mockResolvedValue(STORED)
    render(<Page />)
    fireEvent.click(await screen.findByRole("button", { name: "Спробувати ще раз" }))
    expect(await screen.findByText("SMTP-провайдери")).toBeInTheDocument()
  })

  it("is read-only without platform.settings.write", async () => {
    perms = ["platform.settings.read"]
    getMailSettings.mockResolvedValue(STORED)
    render(<Page />)
    expect(await screen.findByText("Brevo")).toBeInTheDocument()
    expect(screen.getByLabelText("Імʼя", { selector: "#mail-sender-name" })).toBeDisabled()
    expect(screen.getByRole("switch", { name: "Увімкнути «Brevo»" })).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Додати провайдера" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Зберегти" })).not.toBeInTheDocument()
  })

  it("shows the effective sender as placeholders and saves only what is typed", async () => {
    getMailSettings.mockResolvedValue({ ...STORED, Identity: { Sender: { Name: "", Address: "" }, ReplyTo: { Name: "", Address: "" } } })
    saveMailIdentity.mockResolvedValue(STORED)
    render(<Page />)
    const address = await screen.findByPlaceholderText("notifications@mail.cybericebox.com")
    expect(address).toHaveValue("")
    fireEvent.change(screen.getByPlaceholderText("support@cybericebox.com"), { target: { value: " help@cybericebox.com " } })
    fireEvent.click(screen.getAllByRole("button", { name: "Зберегти" })[0])
    await waitFor(() => expect(saveMailIdentity).toHaveBeenCalledWith({
      Sender: { Name: "", Address: "" }, ReplyTo: { Name: "", Address: "help@cybericebox.com" }, SendingDomain: "mail.cybericebox.com",
    }))
    expect(await screen.findByText("Відправника збережено.")).toBeInTheDocument()
  })

  it("validates address format and name length before calling the API", async () => {
    getMailSettings.mockResolvedValue(STORED)
    render(<Page />)
    fireEvent.change(await screen.findByDisplayValue("notifications@mail.cybericebox.com"), { target: { value: "not-an-address" } })
    fireEvent.click(screen.getAllByRole("button", { name: "Зберегти" })[0])
    expect(await screen.findByText("Вкажіть коректну адресу електронної пошти.")).toBeInTheDocument()
    fireEvent.change(screen.getByDisplayValue("not-an-address"), { target: { value: "ok@mail.cybericebox.com" } })
    fireEvent.change(screen.getByDisplayValue("CyberICEBox"), { target: { value: "x".repeat(65) } })
    fireEvent.click(screen.getAllByRole("button", { name: "Зберегти" })[0])
    expect(await screen.findByText("Імʼя має бути не довшим за 64 символів.")).toBeInTheDocument()
    expect(saveMailIdentity).not.toHaveBeenCalled()
  })

  it("edits the sending domain: the server config domain is the placeholder, a saved one overrides it", async () => {
    getMailSettings.mockResolvedValue({ ...STORED, SavedSendingDomain: "", SendingDomain: "cybericebox.com", Sources: { ...STORED.Sources, SendingDomain: "env" } })
    saveMailIdentity.mockResolvedValue(STORED)
    render(<Page />)
    const field = await screen.findByLabelText("Домен відправлення")
    expect(field).toHaveValue("")
    expect(field).toHaveAttribute("placeholder", "cybericebox.com")
    expect(screen.getByText(/тег@cybericebox\.com/)).toBeInTheDocument()
    fireEvent.change(field, { target: { value: " Mail.CyberICEBox.com " } })
    fireEvent.click(screen.getAllByRole("button", { name: "Зберегти" })[0])
    await waitFor(() => expect(saveMailIdentity).toHaveBeenCalledWith(expect.objectContaining({ SendingDomain: "mail.cybericebox.com" })))
  })

  it("rejects a malformed sending domain before calling the API", async () => {
    getMailSettings.mockResolvedValue(STORED)
    render(<Page />)
    for (const bad of ["localhost", "a@b.com", "https://mail.example.com", "mail example.com"]) {
      fireEvent.change(await screen.findByLabelText("Домен відправлення"), { target: { value: bad } })
      fireEvent.click(screen.getAllByRole("button", { name: "Зберегти" })[0])
      expect(await screen.findByText("Вкажіть коректний домен, наприклад mail.example.com.")).toBeInTheDocument()
    }
    expect(saveMailIdentity).not.toHaveBeenCalled()
  })

  it("tells in each tooltip where the value in effect comes from", async () => {
    getMailSettings.mockResolvedValue({ ...STORED, Sources: { SenderName: "default", SenderAddress: "env", ReplyToName: "none", ReplyToAddress: "derived", SendingDomain: "saved" } })
    render(<Page />)
    await screen.findByLabelText("Домен відправлення")
    expect(screen.getByRole("button", { name: /Зараз: береться з конфігурації сервера \(SMTP_SENDER_EMAIL\)\./ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Зараз: значення за замовчуванням платформи\./ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Зараз: збережено в системі\./ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Зараз: складено зі збереженого домену відправлення\./ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Зараз: не задано\./ })).toBeInTheDocument()
  })

  it("keeps the providers and the footer enabled while the sender saves", async () => {
    getMailSettings.mockResolvedValue(STORED)
    saveMailIdentity.mockReturnValue(new Promise(() => {}))
    render(<Page />)
    await screen.findByText("SMTP-провайдери")
    const saves = screen.getAllByRole("button", { name: "Зберегти" })
    fireEvent.click(saves[0])
    await waitFor(() => expect(saveMailIdentity).toHaveBeenCalled())
    expect(saves[0]).toBeDisabled()
    expect(saves[1]).toBeEnabled()
    expect(screen.getByLabelText("Домен відправлення")).toBeEnabled()
    expect(screen.getByRole("switch", { name: "Увімкнути «Brevo»" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Додати провайдера" })).toBeEnabled()
  })
})
