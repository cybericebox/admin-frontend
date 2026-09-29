import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/api/client")

import * as client from "@/api/client"
import { getMailSettings, isValidEmail, isValidSendingDomain, previewMailFooter, saveMailFooter, resetMailSmtp, saveMailIdentity, saveMailSmtp, testMailSmtp, type MailSmtpInput } from "./settings"

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
    const identity = { Sender: { Name: "CyberICEBox", Address: "n@mail.x.y" }, ReplyTo: { Name: "", Address: "help@x.y" }, SendingDomain: "mail.x.y" }
    await saveMailIdentity(identity)
    expect(client.apiPut).toHaveBeenCalledWith("/api/mail/settings/identity", identity)
  })

  it("saves and previews the footer as a document, null for the default", async () => {
    const doc = { root: { type: "root", children: [] } }
    await saveMailFooter(doc)
    expect(client.apiPut).toHaveBeenCalledWith("/api/mail/settings/footer", { Content: doc })
    await previewMailFooter(null)
    expect(client.apiPost).toHaveBeenCalledWith("/api/mail/settings/footer/preview", { Content: null })
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

describe("isValidSendingDomain", () => {
  it("accepts an empty value and hostnames of two or more labels", () => {
    for (const ok of ["", "mail.example.com", "xn--80ak6aa92e.com", "a-b.example.co.uk"]) expect(isValidSendingDomain(ok), ok).toBe(true)
  })
  it("rejects addresses, URLs, single labels, IPs and malformed labels", () => {
    for (const bad of ["localhost", "a@mail.example.com", "https://mail.example.com", "mail.example.com/", "mail example.com", "-a.example.com", "a-.example.com", "a..example.com", "192.168.0.1", "mail.example.com:25"]) expect(isValidSendingDomain(bad), bad).toBe(false)
  })
})
