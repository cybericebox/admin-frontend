import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { MailFooter, MailSettings } from "@/api/mail/settings"

const previewMailFooter = vi.fn()
const saveMailFooter = vi.fn()
vi.mock("@/api/mail/settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/mail/settings")>()),
  previewMailFooter: (text: string) => previewMailFooter(text),
  saveMailFooter: (text: string) => saveMailFooter(text),
}))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: () => true }) }))

import { MailFooterCard, footerDraft, footerPayload } from "./MailFooterCard"

const DEFAULT = "{platform_name} · {site_url}\nПитання? Пишіть на {reply_to}."
const FOOTER: MailFooter = { Text: "", DefaultText: DEFAULT, Variables: ["platform_name", "site_url", "privacy_url", "reply_to"] }

describe("footer draft helpers", () => {
  it("shows the default while nothing is saved and stores the default as empty", () => {
    expect(footerDraft(FOOTER)).toBe(DEFAULT)
    expect(footerDraft({ ...FOOTER, Text: "custom" })).toBe("custom")
    expect(footerPayload(`  ${DEFAULT}\n`, FOOTER)).toBe("")
    expect(footerPayload("custom {site_url} ", FOOTER)).toBe("custom {site_url}")
  })
})

describe("MailFooterCard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    previewMailFooter.mockResolvedValue({ HTML: "<p>Cyber ICE Box · https://x.y</p>", Text: "" })
  })

  it("renders the backend preview of the (debounced) draft", async () => {
    render(<MailFooterCard footer={FOOTER} canWrite onSaved={() => {}} />)
    expect(await screen.findByText("Cyber ICE Box · https://x.y")).toBeInTheDocument()
    expect(previewMailFooter).toHaveBeenLastCalledWith("")

    fireEvent.change(screen.getByLabelText("Текст підвалу"), { target: { value: "Привіт {site_url}" } })
    await waitFor(() => expect(previewMailFooter).toHaveBeenLastCalledWith("Привіт {site_url}"))
  })

  it("inserts a variable at the caret", async () => {
    render(<MailFooterCard footer={{ ...FOOTER, Text: "ab" }} canWrite onSaved={() => {}} />)
    const field = screen.getByLabelText("Текст підвалу") as HTMLTextAreaElement
    field.setSelectionRange(1, 1)
    fireEvent.click(screen.getByRole("button", { name: "Вставити {reply_to}" }))
    expect(field.value).toBe("a{reply_to}b")
  })

  it("shows the rendering error instead of the preview, and an empty state for an empty footer", async () => {
    previewMailFooter.mockRejectedValueOnce(new Error("Footer uses an unknown variable"))
    render(<MailFooterCard footer={FOOTER} canWrite onSaved={() => {}} />)
    expect(await screen.findByRole("alert")).toBeInTheDocument()

    previewMailFooter.mockResolvedValue({ HTML: "", Text: "" })
    fireEvent.click(screen.getByRole("button", { name: "Спробувати ще раз" }))
    expect(await screen.findByText("Підвал порожній: жоден рядок не має значень.")).toBeInTheDocument()
  })

  it("saves the default as empty text, then reports and hands the settings up", async () => {
    const saved = { Footer: { ...FOOTER, Text: "custom" } } as MailSettings
    saveMailFooter.mockResolvedValue(saved)
    const onSaved = vi.fn()
    render(<MailFooterCard footer={FOOTER} canWrite onSaved={onSaved} />)
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Зберегти" })) })
    expect(saveMailFooter).toHaveBeenCalledWith("")
    expect(onSaved).toHaveBeenCalledWith(saved)
    expect(await screen.findByText("Підвал листів збережено.")).toBeInTheDocument()
    expect((screen.getByLabelText("Текст підвалу") as HTMLTextAreaElement).value).toBe("custom")
  })

  it("restores the default text on demand", () => {
    render(<MailFooterCard footer={{ ...FOOTER, Text: "custom" }} canWrite onSaved={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: "Типовий текст" }))
    expect((screen.getByLabelText("Текст підвалу") as HTMLTextAreaElement).value).toBe(DEFAULT)
  })

  it("is read-only without write access", () => {
    render(<MailFooterCard footer={FOOTER} canWrite={false} onSaved={() => {}} />)
    expect(screen.getByLabelText("Текст підвалу")).toBeDisabled()
  })
})
