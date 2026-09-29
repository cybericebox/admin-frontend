import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/api/client")

import * as client from "@/api/client"
import { getMailSettings, isValidEmail, resetMailSmtp, saveMailIdentity, saveMailSmtp, testMailSmtp, type MailSmtpInput } from "./settings"

const smtp: MailSmtpInput = {
  Host: "email-smtp.eu-central-1.amazonaws.com",
  Port: 587,
  TLSMode: "starttls",
  Username: "AKIA",
  Password: "",
  ClearPassword: false,
}

describe("mail settings API", () => {
  beforeEach(() => vi.clearAllMocks())

  it("reads the platform settings", async () => {
    vi.mocked(client.apiGet).mockResolvedValue({ Source: "none" })
    await getMailSettings()
    expect(client.apiGet).toHaveBeenCalledWith("/api/mail/settings")
  })

  it("saves sender and Reply-To separately from the SMTP", async () => {
    const identity = { Sender: { Name: "CyberICEBox", Address: "n@mail.x.y" }, ReplyTo: { Name: "", Address: "help@x.y" } }
    await saveMailIdentity(identity)
    expect(client.apiPut).toHaveBeenCalledWith("/api/mail/settings/identity", identity)
  })

  it("saves the SMTP form body", async () => {
    await saveMailSmtp(smtp)
    expect(client.apiPut).toHaveBeenCalledWith("/api/mail/settings/smtp", smtp)
  })

  it("resets to the env fallback with DELETE", async () => {
    await resetMailSmtp()
    expect(client.apiDelete).toHaveBeenCalledWith("/api/mail/settings/smtp")
  })

  it("tests the given SMTP, or the stored one with an empty body", async () => {
    await testMailSmtp(smtp)
    expect(client.apiPost).toHaveBeenLastCalledWith("/api/mail/settings/smtp/test", smtp)
    await testMailSmtp()
    expect(client.apiPost).toHaveBeenLastCalledWith("/api/mail/settings/smtp/test", {})
  })

  it("accepts empty and well-formed addresses only", () => {
    expect(isValidEmail("")).toBe(true)
    expect(isValidEmail("a@mail.example.com")).toBe(true)
    expect(isValidEmail("no-at-sign")).toBe(false)
    expect(isValidEmail("a b@x.y")).toBe(false)
  })
})
