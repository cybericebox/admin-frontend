import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/api/client")

import * as client from "@/api/client"
import { domainOf, getMailSettings, resetMailSettings, saveMailSettings, testMailSettings, type MailSettingsInput } from "./settings"

const input: MailSettingsInput = {
  Host: "email-smtp.eu-central-1.amazonaws.com",
  Port: 587,
  TLSMode: "starttls",
  Username: "AKIA",
  Password: "",
  ClearPassword: false,
  FromName: "CyberICEBox",
  FromAddress: "notifications@mail.cybericebox.com",
  ReplyTo: "support@cybericebox.com",
}

describe("mail settings API", () => {
  beforeEach(() => vi.clearAllMocks())

  it("reads the platform settings", async () => {
    vi.mocked(client.apiGet).mockResolvedValue({ Source: "none" })
    await getMailSettings()
    expect(client.apiGet).toHaveBeenCalledWith("/api/mail/settings")
  })

  it("saves the whole form body", async () => {
    await saveMailSettings(input)
    expect(client.apiPut).toHaveBeenCalledWith("/api/mail/settings", input)
  })

  it("resets to the env fallback with DELETE", async () => {
    await resetMailSettings()
    expect(client.apiDelete).toHaveBeenCalledWith("/api/mail/settings")
  })

  it("tests the given settings, or the stored ones with an empty body", async () => {
    await testMailSettings(input)
    expect(client.apiPost).toHaveBeenLastCalledWith("/api/mail/settings/test", input)
    await testMailSettings()
    expect(client.apiPost).toHaveBeenLastCalledWith("/api/mail/settings/test", {})
  })

  it("derives the sending domain from an address", () => {
    expect(domainOf("notifications@Mail.CyberICEBox.com")).toBe("mail.cybericebox.com")
    expect(domainOf("no-at-sign")).toBe("")
  })
})
