import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { MailSettings } from "@/api/mail/settings"

const getMailSettings = vi.fn()
const saveMailIdentity = vi.fn()
const saveMailSmtp = vi.fn()
const resetMailSmtp = vi.fn()
const testMailSmtp = vi.fn()
vi.mock("@/api/mail/settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/mail/settings")>()),
  previewMailFooter: () => Promise.resolve({ HTML: "<p>preview</p>", Text: "preview" }),
  getMailSettings: () => getMailSettings(),
  saveMailIdentity: (input: unknown) => saveMailIdentity(input),
  saveMailSmtp: (input: unknown) => saveMailSmtp(input),
  resetMailSmtp: () => resetMailSmtp(),
  testMailSmtp: (input: unknown) => testMailSmtp(input),
}))
let perms = ["platform.settings.read", "platform.settings.write"]
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: (perm: string) => perms.includes(perm) }) }))
vi.mock("next/navigation", () => ({ usePathname: () => "/settings/mail" }))

import Page from "./page"

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
  SMTP: { Host: "smtp.example.com", Port: 587, TLSMode: "starttls", Username: "mailer", PasswordSet: true, UpdatedAt: "2026-09-29T10:00:00Z" },
  Env: null,
}

describe("mail settings page", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    perms = ["platform.settings.read", "platform.settings.write"]
  })

  it("shows the database source, sending domain and keeps the stored password on save", async () => {
    getMailSettings.mockResolvedValue(STORED)
    saveMailSmtp.mockResolvedValue({ ...STORED, Host: "smtp2.example.com" })
    render(<Page />)
    expect(await screen.findByText("Налаштування платформи")).toBeInTheDocument()
    expect(screen.getByLabelText("Домен відправлення")).toHaveValue("mail.cybericebox.com")
    expect(screen.getByPlaceholderText("Пароль збережено")).toHaveValue("")
    fireEvent.change(screen.getByLabelText("Сервер"), { target: { value: "smtp2.example.com" } })
    fireEvent.click(screen.getAllByRole("button", { name: "Зберегти" })[2])
    await waitFor(() => expect(saveMailSmtp).toHaveBeenCalledWith({
      Host: "smtp2.example.com", Port: 587, TLSMode: "starttls", Username: "mailer", Password: "", ClearPassword: false,
    }))
    expect(await screen.findByText("Налаштування пошти збережено.")).toBeInTheDocument()
  })

  it("sends ClearPassword after «Видалити пароль»", async () => {
    getMailSettings.mockResolvedValue(STORED)
    saveMailSmtp.mockResolvedValue({ ...STORED, PasswordSet: false })
    render(<Page />)
    fireEvent.click(await screen.findByRole("button", { name: "Видалити пароль" }))
    expect(screen.getByText("Пароль буде видалено після збереження")).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole("button", { name: "Зберегти" })[2])
    await waitFor(() => expect(saveMailSmtp).toHaveBeenCalledWith(expect.objectContaining({ Password: "", ClearPassword: true })))
  })

  it("tests the current form values and shows the result inline", async () => {
    getMailSettings.mockResolvedValue(STORED)
    testMailSmtp.mockResolvedValue({ Sent: false, Recipient: "admin@example.com", Transport: "platform", Error: "535 auth failed" })
    render(<Page />)
    fireEvent.change(await screen.findByLabelText("Порт"), { target: { value: "2525" } })
    fireEvent.click(screen.getByRole("button", { name: "Перевірити підключення" }))
    await waitFor(() => expect(testMailSmtp).toHaveBeenCalledWith(expect.objectContaining({ Host: "smtp.example.com", Port: 2525 })))
    expect(await screen.findByText(/admin@example.com: 535 auth failed/)).toBeInTheDocument()
  })

  it("validates the port before calling the API", async () => {
    getMailSettings.mockResolvedValue(STORED)
    render(<Page />)
    fireEvent.change(await screen.findByLabelText("Порт"), { target: { value: "70000" } })
    fireEvent.click(screen.getAllByRole("button", { name: "Зберегти" })[2])
    expect(await screen.findByText("Порт має бути цілим числом від 1 до 65535.")).toBeInTheDocument()
    expect(saveMailSmtp).not.toHaveBeenCalled()
  })

  it("returns to env settings after confirmation", async () => {
    getMailSettings.mockResolvedValue(STORED)
    resetMailSmtp.mockResolvedValue({ ...STORED, Source: "env", SMTP: null, Env: { Host: "smtp.env", Port: 465, FromName: "Env", FromAddress: "env@example.com", ReplyTo: "" } })
    render(<Page />)
    fireEvent.click(await screen.findByRole("button", { name: "Повернутися до налаштувань оточення" }))
    fireEvent.click(await screen.findByRole("button", { name: "Видалити налаштування" }))
    await waitFor(() => expect(resetMailSmtp).toHaveBeenCalled())
    expect(await screen.findByText("Резервні налаштування з оточення (SMTP_*)")).toBeInTheDocument()
    expect(screen.getByText(/smtp\.env:465/)).toBeInTheDocument()
    expect(screen.getByLabelText("Сервер")).toHaveValue("smtp.env")
  })

  it("is read-only without platform.settings.write", async () => {
    perms = ["platform.settings.read"]
    getMailSettings.mockResolvedValue({ ...STORED, Source: "none", Configured: false, SMTP: null })
    render(<Page />)
    expect(await screen.findByText("Пошту не налаштовано")).toBeInTheDocument()
    expect(screen.getByLabelText("Сервер")).toBeDisabled()
    expect(screen.getByLabelText("Ім'я", { selector: "#mail-sender-name" })).toBeDisabled()
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
    expect(saveMailSmtp).not.toHaveBeenCalled()
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
    expect(await screen.findByText("Ім'я має бути не довшим за 64 символів.")).toBeInTheDocument()
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
})
