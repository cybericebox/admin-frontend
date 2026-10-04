import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { LexicalState, MailFooter, MailSettings } from "@/api/mail/settings"
import type { RichTextEditorProps } from "@/components/notifications/editor/RichTextEditor"

const previewMailFooter = vi.fn()
const saveMailFooter = vi.fn()
vi.mock("@/api/mail/settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/mail/settings")>()),
  previewMailFooter: (doc: unknown) => previewMailFooter(doc),
  saveMailFooter: (doc: unknown) => saveMailFooter(doc),
}))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: () => true }) }))

// Lexical needs a real browser for typing; the wiring is what is tested here.
// The real editor is mounted in the smoke test below.
let editorProps: RichTextEditorProps | null = null
vi.mock("@/components/notifications/editor/RichTextEditor", () => ({
  RichTextEditor: (props: RichTextEditorProps) => {
    editorProps = props
    return <div data-testid="editor" data-disabled={props.disabled ? "yes" : "no"} data-value={JSON.stringify(props.value)} />
  },
}))

import { MailFooterCard, documentSignature, footerDraft, footerVariables } from "./MailFooterCard"

const doc = (...children: unknown[]): LexicalState => ({ root: { type: "root", children: [{ type: "paragraph", children }] } })
const text = (value: string) => ({ type: "text", text: value })
const variable = (varName: string) => ({ type: "variable", varName })

const DEFAULT = doc(variable("platform_name"), text(" · "), variable("site_url"))
const FOOTER: MailFooter = { Content: null, DefaultContent: DEFAULT, Variables: ["platform_name", "site_url", "privacy_url", "reply_to"] }

describe("footer helpers", () => {
  it("shows the default while nothing is saved", () => {
    expect(footerDraft(FOOTER)).toBe(DEFAULT)
    const custom = doc(text("custom"))
    expect(footerDraft({ ...FOOTER, Content: custom })).toBe(custom)
  })

  it("offers every footer variable with its help and an example", () => {
    const defs = footerVariables(FOOTER.Variables)
    expect(defs.map((d) => d.name)).toEqual(["platform_name", "site_url", "privacy_url", "reply_to"])
    expect(defs[3]).toEqual({ name: "reply_to", description: "Адреса для відповідей", example: "support@example.com" })
  })

  it("compares documents by content, not by editor bookkeeping", () => {
    const withIds = { root: { type: "root", version: 1, children: [{ type: "paragraph", version: 1, direction: "ltr", children: [{ ...variable("platform_name"), version: 1 }, { ...text(" · "), format: 0, detail: 0 }, variable("site_url")] }] } }
    expect(documentSignature((withIds as LexicalState).root)).toBe(documentSignature((DEFAULT as LexicalState).root))
    expect(documentSignature((doc(text("other")) as LexicalState).root)).not.toBe(documentSignature((DEFAULT as LexicalState).root))
  })
})

describe("MailFooterCard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    editorProps = null
    previewMailFooter.mockResolvedValue({ HTML: "<p>Cyber ICE Box · https://x.y</p>", Text: "" })
  })

  it("gives the editor the draft, the footer variables and the amber pills of the email body editor", () => {
    render(<MailFooterCard footer={FOOTER} canWrite onSaved={() => {}} />)
    expect(editorProps?.value).toBe(DEFAULT)
    expect(editorProps?.variables?.map((v) => v.name)).toEqual(FOOTER.Variables)
    expect(editorProps?.showVariableNames).toBe(true)
    expect(editorProps?.className).toContain("data-notif-variable")
  })

  it("renders the backend preview of the (debounced) draft in the email preview frame", async () => {
    render(<MailFooterCard footer={FOOTER} canWrite onSaved={() => {}} />)
    await waitFor(() => expect(screen.getByTestId("mail-footer-preview").querySelector("iframe")).not.toBeNull())
    const frame = screen.getByTestId("mail-footer-preview").querySelector("iframe") as HTMLIFrameElement
    expect(frame.getAttribute("sandbox")).toBe("")
    expect(frame.getAttribute("srcdoc")).toContain("Cyber ICE Box · https://x.y")
    expect(previewMailFooter).toHaveBeenLastCalledWith(DEFAULT)

    const edited = doc(text("Привіт"), variable("site_url"))
    act(() => editorProps?.onChange(edited))
    await waitFor(() => expect(previewMailFooter).toHaveBeenLastCalledWith(edited))
  })

  it("shows the rendering error instead of the preview, and an empty state for an empty footer", async () => {
    previewMailFooter.mockRejectedValueOnce(new Error("Footer uses an unknown variable"))
    render(<MailFooterCard footer={FOOTER} canWrite onSaved={() => {}} />)
    expect(await screen.findByRole("alert")).toBeInTheDocument()

    previewMailFooter.mockResolvedValue({ HTML: "", Text: "" })
    fireEvent.click(screen.getByRole("button", { name: "Спробувати ще раз" }))
    expect(await screen.findByText("Підвал порожній: жоден рядок не має значень.")).toBeInTheDocument()
  })

  it("saves the document, then reports and hands the settings up", async () => {
    const custom = doc(text("custom"))
    const saved = { Footer: { ...FOOTER, Content: custom } } as MailSettings
    saveMailFooter.mockResolvedValue(saved)
    const onSaved = vi.fn()
    render(<MailFooterCard footer={FOOTER} canWrite onSaved={onSaved} />)
    act(() => editorProps?.onChange(custom))
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Зберегти" })) })
    expect(saveMailFooter).toHaveBeenCalledWith(custom)
    expect(onSaved).toHaveBeenCalledWith(saved)
    expect(await screen.findByText("Підвал листів збережено.")).toBeInTheDocument()
    expect(editorProps?.value).toBe(custom)
  })

  it("refuses a document over the size limit without calling the API", async () => {
    render(<MailFooterCard footer={FOOTER} canWrite onSaved={() => {}} />)
    act(() => editorProps?.onChange(doc(text("я".repeat(11000)))))
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Зберегти" })) })
    expect(await screen.findByText("Підвал завеликий. Скоротіть текст.")).toBeInTheDocument()
    expect(saveMailFooter).not.toHaveBeenCalled()
  })

  it("restores the default footer on demand", () => {
    const custom = doc(text("custom"))
    render(<MailFooterCard footer={{ ...FOOTER, Content: custom }} canWrite onSaved={() => {}} />)
    expect(screen.getByRole("button", { name: "Типовий підвал" })).toBeEnabled()
    fireEvent.click(screen.getByRole("button", { name: "Типовий підвал" }))
    expect(editorProps?.value).toBe(DEFAULT)
    expect(screen.getByRole("button", { name: "Типовий підвал" })).toBeDisabled()
  })

  it("is read-only without write access", () => {
    render(<MailFooterCard footer={FOOTER} canWrite={false} onSaved={() => {}} />)
    expect(screen.getByTestId("editor")).toHaveAttribute("data-disabled", "yes")
  })

  it("keeps the editor and the reset button enabled while a save is pending", async () => {
    let finish: (value: MailSettings) => void = () => {}
    saveMailFooter.mockReturnValue(new Promise<MailSettings>((resolve) => { finish = resolve }))
    render(<MailFooterCard footer={{ ...FOOTER, Content: doc(text("custom")) }} canWrite onSaved={() => {}} />)
    const save = screen.getByRole("button", { name: "Зберегти" })
    await act(async () => { fireEvent.click(save) })
    expect(save).toBeDisabled()
    expect(screen.getByTestId("editor")).toHaveAttribute("data-disabled", "no")
    expect(screen.getByRole("button", { name: "Типовий підвал" })).toBeEnabled()
    // A newer edit made during the save is not overwritten by the answer.
    const newer = doc(text("newer"))
    act(() => editorProps?.onChange(newer))
    await act(async () => { finish({ Footer: { ...FOOTER, Content: doc(text("custom")) } } as MailSettings) })
    expect(editorProps?.value).toBe(newer)
  })
})
