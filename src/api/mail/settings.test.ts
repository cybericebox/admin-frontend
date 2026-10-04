import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/api/client")

import * as client from "@/api/client"
import { createMailProvider, deleteMailProvider, getMailSettings, isValidEmail, isValidSendingDomain, previewMailFooter, reorderMailProviders, saveMailFooter, saveMailIdentity, saveMailProvider, setMailProviderEnabled, testMailProvider, testMailProviderForm, testMailTransportInUse, type MailProviderInput } from "./settings"

const provider: MailProviderInput = {
  Name: "SES",
  Sender: { Name: "", Address: "" },
  ReplyTo: { Name: "", Address: "" },
  Host: "email-smtp.eu-central-1.amazonaws.com",
  Port: 587,
  TLSMode: "starttls",
  Username: "AKIA",
  Password: "",
  ClearPassword: false,
  MaxPerSecond: 14,
  DailyQuota: 50000,
}
const ID = "0197a1b2-0000-7000-8000-000000000001"

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

  it("adds and saves a provider with the whole form body", async () => {
    await createMailProvider(provider)
    expect(client.apiPost).toHaveBeenLastCalledWith("/api/mail/settings/providers", provider)
    await saveMailProvider(ID, provider)
    expect(client.apiPut).toHaveBeenLastCalledWith(`/api/mail/settings/providers/${ID}`, provider)
  })

  it("switches, deletes and orders providers", async () => {
    await setMailProviderEnabled(ID, false)
    expect(client.apiPatch).toHaveBeenLastCalledWith(`/api/mail/settings/providers/${ID}/enabled`, { Enabled: false })
    await deleteMailProvider(ID)
    expect(client.apiDelete).toHaveBeenLastCalledWith(`/api/mail/settings/providers/${ID}`)
    await reorderMailProviders([ID, "b"])
    expect(client.apiPut).toHaveBeenLastCalledWith("/api/mail/settings/providers/order", { IDs: [ID, "b"] })
  })

  it("tests a stored provider, form values (with the provider id for its password), or the transport in use", async () => {
    await testMailProvider(ID)
    expect(client.apiPost).toHaveBeenLastCalledWith(`/api/mail/settings/providers/${ID}/test`, {})
    await testMailProviderForm(provider, ID)
    expect(client.apiPost).toHaveBeenLastCalledWith("/api/mail/settings/providers/test", { ...provider, ID })
    await testMailProviderForm(provider)
    expect(client.apiPost).toHaveBeenLastCalledWith("/api/mail/settings/providers/test", { ...provider, ID: "" })
    await testMailTransportInUse()
    expect(client.apiPost).toHaveBeenLastCalledWith("/api/mail/settings/providers/test", {})
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
