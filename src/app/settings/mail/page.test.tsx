import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { MailSettings } from "@/api/mail/settings"

const getMailSettings = vi.fn()
const saveMailSettings = vi.fn()
const resetMailSettings = vi.fn()
const testMailSettings = vi.fn()
vi.mock("@/api/mail/settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/mail/settings")>()),
  getMailSettings: () => getMailSettings(),
  saveMailSettings: (input: unknown) => saveMailSettings(input),
  resetMailSettings: () => resetMailSettings(),
  testMailSettings: (input: unknown) => testMailSettings(input),
}))
let perms = ["platform.settings.read", "platform.settings.write"]
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: (perm: string) => perms.includes(perm) }) }))
vi.mock("next/navigation", () => ({ usePathname: () => "/settings/mail" }))

import Page from "./page"

const STORED: MailSettings = {
  Source: "database",
  Configured: true,
  Host: "smtp.example.com",
  Port: 587,
  TLSMode: "starttls",
  Username: "mailer",
  PasswordSet: true,
  FromName: "CyberICEBox",
  FromAddress: "notifications@mail.cybericebox.com",
  ReplyTo: "support@cybericebox.com",
  SendingDomain: "mail.cybericebox.com",
  Env: null,
  UpdatedAt: "2026-09-29T10:00:00Z",
}

describe("mail settings page", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    perms = ["platform.settings.read", "platform.settings.write"]
  })

  it("shows the database source, sending domain and keeps the stored password on save", async () => {
    getMailSettings.mockResolvedValue(STORED)
    saveMailSettings.mockResolvedValue({ ...STORED, Host: "smtp2.example.com" })
    render(<Page />)
    expect(await screen.findByText("Налаштування платформи")).toBeInTheDocument()
    expect(screen.getByText("mail.cybericebox.com")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Пароль збережено")).toHaveValue("")
    fireEvent.change(screen.getByLabelText("Сервер"), { target: { value: "smtp2.example.com" } })
    fireEvent.click(screen.getByRole("button", { name: "Зберегти" }))
    await waitFor(() => expect(saveMailSettings).toHaveBeenCalledWith({
      Host: "smtp2.example.com", Port: 587, TLSMode: "starttls", Username: "mailer", Password: "", ClearPassword: false,
      FromName: "CyberICEBox", FromAddress: "notifications@mail.cybericebox.com", ReplyTo: "support@cybericebox.com",
    }))
    expect(await screen.findByText("Налаштування пошти збережено.")).toBeInTheDocument()
  })

  it("sends ClearPassword after «Видалити пароль»", async () => {
    getMailSettings.mockResolvedValue(STORED)
    saveMailSettings.mockResolvedValue({ ...STORED, PasswordSet: false })
    render(<Page />)
    fireEvent.click(await screen.findByRole("button", { name: "Видалити пароль" }))
    expect(screen.getByText("Пароль буде видалено після збереження")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Зберегти" }))
    await waitFor(() => expect(saveMailSettings).toHaveBeenCalledWith(expect.objectContaining({ Password: "", ClearPassword: true })))
  })

  it("tests the current form values and shows the result inline", async () => {
    getMailSettings.mockResolvedValue(STORED)
    testMailSettings.mockResolvedValue({ Sent: false, Recipient: "admin@example.com", Transport: "platform", Error: "535 auth failed" })
    render(<Page />)
    fireEvent.change(await screen.findByLabelText("Порт"), { target: { value: "2525" } })
    fireEvent.click(screen.getByRole("button", { name: "Перевірити підключення" }))
    await waitFor(() => expect(testMailSettings).toHaveBeenCalledWith(expect.objectContaining({ Host: "smtp.example.com", Port: 2525 })))
    expect(await screen.findByText(/admin@example.com: 535 auth failed/)).toBeInTheDocument()
  })

  it("validates the port before calling the API", async () => {
    getMailSettings.mockResolvedValue(STORED)
    render(<Page />)
    fireEvent.change(await screen.findByLabelText("Порт"), { target: { value: "70000" } })
    fireEvent.click(screen.getByRole("button", { name: "Зберегти" }))
    expect(await screen.findByText("Порт має бути цілим числом від 1 до 65535.")).toBeInTheDocument()
    expect(saveMailSettings).not.toHaveBeenCalled()
  })

  it("returns to env settings after confirmation", async () => {
    getMailSettings.mockResolvedValue(STORED)
    resetMailSettings.mockResolvedValue({ ...STORED, Source: "env", Host: "", Username: "", PasswordSet: false, Env: { Host: "smtp.env", Port: 465, FromName: "Env", FromAddress: "env@example.com", ReplyTo: "" } })
    render(<Page />)
    fireEvent.click(await screen.findByRole("button", { name: "Повернутися до налаштувань оточення" }))
    fireEvent.click(await screen.findByRole("button", { name: "Видалити налаштування" }))
    await waitFor(() => expect(resetMailSettings).toHaveBeenCalled())
    expect(await screen.findByText("Резервні налаштування з оточення (SMTP_*)")).toBeInTheDocument()
    expect(screen.getByText(/smtp\.env:465/)).toBeInTheDocument()
    expect(screen.getByLabelText("Сервер")).toHaveValue("smtp.env")
  })

  it("is read-only without platform.settings.write", async () => {
    perms = ["platform.settings.read"]
    getMailSettings.mockResolvedValue({ ...STORED, Source: "none", Configured: false, Host: "", PasswordSet: false })
    render(<Page />)
    expect(await screen.findByText("Пошту не налаштовано")).toBeInTheDocument()
    expect(screen.getByLabelText("Сервер")).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Зберегти" })).not.toBeInTheDocument()
  })
})
