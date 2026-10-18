import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import type { LimitField, LimitSettings } from "@/api/platformLimits"

const get = vi.fn()
const save = vi.fn()
const reset = vi.fn()
vi.mock("@/api/platformLimits", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/platformLimits")>()),
  getLimitSettings: (card: string) => get(card),
  saveLimitSettings: (card: string, values: unknown) => save(card, values),
  resetLimitSettings: (card: string) => reset(card),
}))
const policyGet = vi.fn()
vi.mock("@/api/privacyPolicy", () => ({ getPolicyRetention: () => policyGet() }))
const toastError = vi.fn()
vi.mock("@/components/ui/toast", () => ({ toast: { error: (m: string) => toastError(m), success: vi.fn(), warning: vi.fn() } }))
let permissions = ["platform.settings.read", "platform.settings.write"]
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: (perm: string) => permissions.includes(perm) }) }))

import { ApiError } from "@/api/client"
import { t } from "@/i18n/t"
import { LimitSettingsCard } from "./LimitSettingsCard"

const HOUR = 3600
const DAY = 24 * HOUR

function field(Key: string, Value: number, extra: Partial<LimitField> = {}): LimitField {
  return { Key, Kind: "duration", Value, Default: Value, Min: HOUR, Max: 3650 * DAY, InPrivacyPolicy: false, ...extra }
}

const leases: LimitSettings = {
  Custom: true, UpdatedAt: "2026-10-18T10:00:00Z",
  Fields: [field("Lease", 36 * HOUR, { Default: 2 * HOUR, Max: 24 * HOUR * 7 }), field("LeaseMax", 72 * HOUR, { Default: 8 * HOUR, Max: 168 * HOUR })],
}
const retention: LimitSettings = {
  Custom: false, UpdatedAt: null,
  Fields: [
    field("InactiveAccount", 3 * 365 * DAY, { Min: 180 * DAY, InPrivacyPolicy: true }),
    field("InactivityGrace", 30 * DAY, { Min: 7 * DAY, Max: 365 * DAY }),
  ],
}

function renderLeases(view = leases) {
  get.mockResolvedValue(view)
  render(<LimitSettingsCard card="test-runs" title="Тестові запуски" groups={[{ keys: ["Lease", "LeaseMax"] }]}
    units={{ Lease: ["hours", "days"], LeaseMax: ["hours", "days"] }} labelKey={(key) => `admin.limits.field.${key}`} />)
}

function renderRetention(view = retention) {
  get.mockResolvedValue(view)
  render(<LimitSettingsCard card="retention" title="Зберігання" groups={[{ titleKey: "admin.limits.group.accounts", keys: ["InactiveAccount", "InactivityGrace"] }]}
    units={{ InactiveAccount: ["days", "years"], InactivityGrace: ["days", "years"] }} labelKey={(key) => `admin.limits.field.${key}`} />)
}

const label = (key: string) => t(`admin.limits.field.${key}`)
const unitOf = (key: string) => screen.getByLabelText(t("admin.limits.unitLabel", { field: label(key) })) as HTMLSelectElement
// A busy button also carries the crest loader label in its name.
const saveButton = () => screen.getByRole("button", { name: new RegExp(`${t("admin.limits.save")}$`) })

describe("LimitSettingsCard", () => {
  beforeEach(() => {
    permissions = ["platform.settings.read", "platform.settings.write"]
    get.mockReset(); save.mockReset(); reset.mockReset(); toastError.mockReset(); policyGet.mockReset()
    policyGet.mockResolvedValue({ InactiveAccount: { seconds: 3 * 365 * DAY, kind: "upTo" } })
  })

  it("shows each value in the largest unit that divides it exactly", async () => {
    renderLeases()
    expect(await screen.findByLabelText(label("Lease"))).toHaveValue("36")
    expect(unitOf("Lease").value).toBe("hours")
    expect(screen.getByLabelText(label("LeaseMax"))).toHaveValue("3")
    expect(unitOf("LeaseMax").value).toBe("days")
    expect(get).toHaveBeenCalledWith("test-runs")
  })

  it("shows the default value as a hint", async () => {
    renderLeases()
    expect(await screen.findByText(t("admin.limits.default", { value: "2 год" }))).toBeTruthy()
  })

  it("saves every field in seconds without rounding", async () => {
    renderLeases()
    const lease = await screen.findByLabelText(label("Lease"))
    expect(saveButton()).toBeDisabled()
    fireEvent.change(lease, { target: { value: "2" } })
    fireEvent.change(unitOf("Lease"), { target: { value: "days" } })
    fireEvent.change(screen.getByLabelText(label("LeaseMax")), { target: { value: "7" } })
    save.mockResolvedValue(leases)
    fireEvent.click(saveButton())
    await waitFor(() => expect(save).toHaveBeenCalledWith("test-runs", { Lease: 2 * DAY, LeaseMax: 7 * DAY }))
  })

  it("keeps 36 hours exact when only the other field changes", async () => {
    renderLeases()
    fireEvent.change(await screen.findByLabelText(label("LeaseMax")), { target: { value: "4" } })
    save.mockResolvedValue(leases)
    fireEvent.click(saveButton())
    await waitFor(() => expect(save).toHaveBeenCalledWith("test-runs", { Lease: 36 * HOUR, LeaseMax: 4 * DAY }))
  })

  it("shows a value below the minimum inline and sends nothing", async () => {
    renderRetention()
    const inactive = await screen.findByLabelText(label("InactiveAccount"))
    fireEvent.change(unitOf("InactiveAccount"), { target: { value: "days" } })
    fireEvent.change(inactive, { target: { value: "30" } })
    fireEvent.click(saveButton())
    const block = document.querySelector('[data-field="InactiveAccount"]') as HTMLElement
    expect(within(block).getByRole("alert").textContent).toBe(t("admin.limits.error.range", { min: "180 днів", max: "10 років" }))
    expect(save).not.toHaveBeenCalled()
  })

  it("checks the cross-field rules before saving", async () => {
    renderLeases()
    fireEvent.change(await screen.findByLabelText(label("LeaseMax")), { target: { value: "1" } })
    fireEvent.change(unitOf("LeaseMax"), { target: { value: "hours" } })
    fireEvent.click(saveButton())
    const block = document.querySelector('[data-field="LeaseMax"]') as HTMLElement
    expect(within(block).getByRole("alert").textContent).toBe(t("admin.limits.error.atLeast", { field: label("Lease") }))
    expect(save).not.toHaveBeenCalled()
  })

  it("shows a server error that names a field under that field", async () => {
    renderLeases()
    fireEvent.change(await screen.findByLabelText(label("LeaseMax")), { target: { value: "5" } })
    save.mockRejectedValue(new ApiError(400, { Status: { Code: 20107, Context: { field: "LeaseMax" } } }, "x", undefined, 20107))
    fireEvent.click(saveButton())
    const block = document.querySelector('[data-field="LeaseMax"]') as HTMLElement
    await waitFor(() => expect(within(block).getByRole("alert").textContent).toBe("Найдовший тестовий запуск не може бути коротшим за один строк дії"))
    expect(toastError).not.toHaveBeenCalled()
  })

  it("toasts a server error that names a field the card does not show", async () => {
    get.mockResolvedValue(leases)
    render(<LimitSettingsCard card="test-runs" title="Тестові запуски" groups={[{ keys: ["Lease"] }]}
      units={{ Lease: ["hours", "days"] }} labelKey={(key) => `admin.limits.field.${key}`} />)
    fireEvent.change(await screen.findByLabelText(label("Lease")), { target: { value: "5" } })
    save.mockRejectedValue(new ApiError(400, { Status: { Code: 20107, Context: { field: "LeaseMax" } } }, "x", undefined, 20107))
    fireEvent.click(saveButton())
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Найдовший тестовий запуск не може бути коротшим за один строк дії"))
  })

  it("does not validate fields the card does not show", async () => {
    get.mockResolvedValue({ ...leases, Fields: [leases.Fields[0], { ...leases.Fields[1], Value: 0 }] })
    render(<LimitSettingsCard card="test-runs" title="Тестові запуски" groups={[{ keys: ["Lease"] }]}
      units={{ Lease: ["hours", "days"] }} labelKey={(key) => `admin.limits.field.${key}`} />)
    fireEvent.change(await screen.findByLabelText(label("Lease")), { target: { value: "5" } })
    save.mockResolvedValue(leases)
    fireEvent.click(saveButton())
    await waitFor(() => expect(save).toHaveBeenCalled())
  })

  it("drops the answer of a save that a reset overtook", async () => {
    renderLeases()
    fireEvent.change(await screen.findByLabelText(label("Lease")), { target: { value: "5" } })
    let finish!: (v: LimitSettings) => void
    save.mockReturnValue(new Promise<LimitSettings>((r) => { finish = r }))
    fireEvent.click(saveButton())
    await waitFor(() => expect(saveButton()).toHaveAttribute("aria-busy", "true"))
    const defaults = { ...leases, Custom: false, Fields: leases.Fields.map((f) => ({ ...f, Value: f.Default })) }
    reset.mockResolvedValue(defaults)
    fireEvent.click(screen.getByRole("button", { name: t("admin.limits.reset") }))
    fireEvent.click(await screen.findByRole("button", { name: t("admin.limits.resetConfirm") }))
    await waitFor(() => expect(screen.getByLabelText(label("Lease"))).toHaveValue("2"))
    finish({ ...leases, Fields: [{ ...leases.Fields[0], Value: 5 * HOUR }, leases.Fields[1]] })
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.getByLabelText(label("Lease"))).toHaveValue("2")
  })

  it("does not show a server error on a field edited during the save", async () => {
    renderLeases()
    const lease = await screen.findByLabelText(label("Lease"))
    fireEvent.change(lease, { target: { value: "5" } })
    let fail!: (e: unknown) => void
    save.mockReturnValue(new Promise<LimitSettings>((_, r) => { fail = r }))
    fireEvent.click(saveButton())
    await waitFor(() => expect(saveButton()).toHaveAttribute("aria-busy", "true"))
    fireEvent.change(lease, { target: { value: "6" } })
    fail(new ApiError(400, { Status: { Code: 20104, Context: { field: "Lease", min: HOUR, max: 7 * DAY } } }, "x", undefined, 20104))
    await waitFor(() => expect(saveButton()).not.toHaveAttribute("aria-busy"))
    expect(document.querySelector('[data-field="Lease"]')!.querySelector('[role="alert"]')).toBeNull()
  })

  it("renders a server range error with the field's units", async () => {
    renderLeases()
    fireEvent.change(await screen.findByLabelText(label("Lease")), { target: { value: "5" } })
    save.mockRejectedValue(new ApiError(400, { Status: { Code: 20104, Context: { field: "Lease", min: HOUR, max: 7 * DAY } } }, "x", undefined, 20104))
    fireEvent.click(saveButton())
    const block = document.querySelector('[data-field="Lease"]') as HTMLElement
    await waitFor(() => expect(within(block).getByRole("alert").textContent).toBe(t("admin.limits.error.range", { min: "1 год", max: "7 днів" })))
  })

  it("toasts when the server error field was edited during the save", async () => {
    renderLeases()
    const lease = await screen.findByLabelText(label("Lease"))
    fireEvent.change(lease, { target: { value: "5" } })
    let fail!: (e: unknown) => void
    save.mockReturnValue(new Promise<LimitSettings>((_, r) => { fail = r }))
    fireEvent.click(saveButton())
    await waitFor(() => expect(saveButton()).toHaveAttribute("aria-busy", "true"))
    fireEvent.change(lease, { target: { value: "6" } })
    fail(new ApiError(400, { Status: { Code: 20104, Context: { field: "Lease", min: HOUR, max: 7 * DAY } } }, "x", undefined, 20104))
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Значення налаштування поза допустимими межами"))
  })

  it("closes the reset dialog when a save overtakes the reset", async () => {
    renderLeases()
    fireEvent.change(await screen.findByLabelText(label("Lease")), { target: { value: "5" } })
    let finish!: (v: LimitSettings) => void
    reset.mockReturnValue(new Promise<LimitSettings>((r) => { finish = r }))
    const saveBtn = saveButton()
    fireEvent.click(screen.getByRole("button", { name: t("admin.limits.reset") }))
    fireEvent.click(await screen.findByRole("button", { name: t("admin.limits.resetConfirm") }))
    save.mockReturnValue(new Promise(() => {}))
    fireEvent.click(saveBtn)
    await waitFor(() => expect(save).toHaveBeenCalled())
    finish(leases)
    await waitFor(() => expect(screen.queryByRole("button", { name: t("admin.limits.resetConfirm") })).toBeNull())
  })

  it("toasts a server error without a field", async () => {
    renderLeases()
    fireEvent.change(await screen.findByLabelText(label("Lease")), { target: { value: "5" } })
    save.mockRejectedValue(new ApiError(500, null, "x"))
    fireEvent.click(saveButton())
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(t("error.generic")))
  })

  it("keeps the inputs enabled during a save and busies only the save button", async () => {
    renderLeases()
    const lease = await screen.findByLabelText(label("Lease"))
    fireEvent.change(lease, { target: { value: "5" } })
    let resolve!: (v: LimitSettings) => void
    save.mockReturnValue(new Promise<LimitSettings>((r) => { resolve = r }))
    fireEvent.click(saveButton())
    await waitFor(() => expect(saveButton()).toHaveAttribute("aria-busy", "true"))
    expect(lease).toBeEnabled()
    expect(unitOf("Lease")).toBeEnabled()
    expect(screen.getByLabelText(label("LeaseMax"))).toBeEnabled()
    expect(screen.getByRole("button", { name: t("admin.limits.reset") })).toBeEnabled()
    resolve({ ...leases, Fields: [{ ...leases.Fields[0], Value: 5 * HOUR }, leases.Fields[1]] })
    await waitFor(() => expect(saveButton()).not.toHaveAttribute("aria-busy"))
    expect(saveButton()).toBeDisabled()
  })

  it("keeps edits typed during a save", async () => {
    renderLeases()
    const lease = await screen.findByLabelText(label("Lease"))
    fireEvent.change(lease, { target: { value: "5" } })
    let resolve!: (v: LimitSettings) => void
    save.mockReturnValue(new Promise<LimitSettings>((r) => { resolve = r }))
    fireEvent.click(saveButton())
    fireEvent.change(lease, { target: { value: "6" } })
    resolve({ ...leases, Fields: [{ ...leases.Fields[0], Value: 5 * HOUR }, leases.Fields[1]] })
    await waitFor(() => expect(saveButton()).not.toHaveAttribute("aria-busy"))
    expect(lease).toHaveValue("6")
    expect(saveButton()).toBeEnabled()
  })

  it("resets to defaults only after a danger confirmation", async () => {
    renderLeases()
    fireEvent.click(await screen.findByRole("button", { name: t("admin.limits.reset") }))
    expect(reset).not.toHaveBeenCalled()
    expect(await screen.findByRole("button", { name: t("admin.limits.cancel") })).toHaveFocus()
    reset.mockResolvedValue({ ...leases, Custom: false, Fields: leases.Fields.map((f) => ({ ...f, Value: f.Default })) })
    fireEvent.click(screen.getByRole("button", { name: t("admin.limits.resetConfirm") }))
    await waitFor(() => expect(reset).toHaveBeenCalledWith("test-runs"))
    await waitFor(() => expect(screen.getByLabelText(label("Lease"))).toHaveValue("2"))
    expect(screen.queryByRole("button", { name: t("admin.limits.reset") })).toBeNull()
  })

  it("offers no reset when nothing is saved", async () => {
    renderRetention()
    await screen.findByLabelText(label("InactiveAccount"))
    expect(screen.queryByRole("button", { name: t("admin.limits.reset") })).toBeNull()
  })

  it("shows neither hint when the value equals the default and matches the Policy", async () => {
    policyGet.mockResolvedValue({ InactiveAccount: { seconds: 3 * 365 * DAY, kind: "upTo" } })
    renderRetention()
    await screen.findByLabelText(label("InactiveAccount"))
    await waitFor(() => expect(policyGet).toHaveBeenCalled())
    expect(screen.queryByText(/За замовчуванням/)).toBeNull()
    expect(screen.queryByText(/Політиці/)).toBeNull()
    expect(screen.getByText(t("admin.limits.group.accounts"))).toBeTruthy()
  })

  it("shows only the default hint when the value differs from the default", async () => {
    renderRetention({ ...retention, Fields: [field("InactiveAccount", 3 * 365 * DAY, { Default: 2 * 365 * DAY, Min: 180 * DAY, InPrivacyPolicy: true }), retention.Fields[1]] })
    await screen.findByLabelText(label("InactiveAccount"))
    await waitFor(() => expect(policyGet).toHaveBeenCalled())
    const box = document.querySelector('[data-field="InactiveAccount"]') as HTMLElement
    expect(within(box).getByText(t("admin.limits.default", { value: "2 роки" }))).toBeTruthy()
    expect(within(box).queryByText(/Політиці/)).toBeNull()
  })

  it("shows the coloured Policy line only when the value mismatches the Policy", async () => {
    renderRetention()
    const input = await screen.findByLabelText(label("InactiveAccount"))
    fireEvent.change(unitOf("InactiveAccount"), { target: { value: "days" } })
    fireEvent.change(input, { target: { value: String(3 * 365 + 1) } })
    const box = document.querySelector('[data-field="InactiveAccount"]') as HTMLElement
    const line = await within(box).findByText(t("admin.limits.policy.over", { value: "3 років" }))
    expect(line.closest("p")).toHaveClass("text-destructive")
    expect(within(box).getByText(/За замовчуванням/)).toBeTruthy()
  })

  it("warns in danger color when longer, in warning color when shorter, nothing when equal, and still saves", async () => {
    renderRetention()
    const input = await screen.findByLabelText(label("InactiveAccount"))
    await waitFor(() => expect(policyGet).toHaveBeenCalled())
    fireEvent.change(unitOf("InactiveAccount"), { target: { value: "days" } })
    fireEvent.change(input, { target: { value: String(3 * 365 + 1) } })
    const over = await screen.findByText(t("admin.limits.policy.over", { value: "3 років" }))
    expect(over.closest("p")).toHaveClass("text-destructive")
    fireEvent.change(input, { target: { value: "400" } })
    const under = await screen.findByText(t("admin.limits.policy.under", { value: "3 років" }))
    expect(under.closest("p")).toHaveClass("text-[var(--ib-warn)]")
    fireEvent.change(input, { target: { value: String(3 * 365) } })
    await waitFor(() => expect(screen.queryByText(/Політиці/)).toBeNull())
    save.mockResolvedValue({ ...retention, Custom: true })
    fireEvent.change(input, { target: { value: String(3 * 365 + 1) } })
    fireEvent.click(saveButton())
    await waitFor(() => expect(save).toHaveBeenCalledWith("retention", { InactiveAccount: (3 * 365 + 1) * DAY, InactivityGrace: 30 * DAY }))
  })

  it.each([
    ["after", "через"],
    ["over", "понад"],
    ["plus", "до завершення заходу та ще"],
  ] as const)("reads the Policy's own wording for «%s» and treats any difference as danger", async (kind, phrase) => {
    policyGet.mockResolvedValue({ InactiveAccount: { seconds: 3 * 365 * DAY, kind } })
    renderRetention()
    const input = await screen.findByLabelText(label("InactiveAccount"))
    await waitFor(() => expect(policyGet).toHaveBeenCalled())
    expect(screen.queryByText(/Політиці/)).toBeNull()
    fireEvent.change(unitOf("InactiveAccount"), { target: { value: "days" } })
    for (const days of [400, 3 * 365 + 1]) {
      fireEvent.change(input, { target: { value: String(days) } })
      const mismatch = await screen.findByText(t(`admin.limits.policy.mismatch.${kind}`, { value: "3 роки" }))
      expect(mismatch.closest("p")).toHaveClass("text-destructive")
      expect(mismatch.textContent).toContain(phrase)
    }
    save.mockResolvedValue({ ...retention, Custom: true })
    fireEvent.click(saveButton())
    await waitFor(() => expect(save).toHaveBeenCalled())
  })

  it("does not block saving when the Policy cannot be loaded", async () => {
    policyGet.mockRejectedValue(new Error("offline"))
    renderRetention()
    const input = await screen.findByLabelText(label("InactiveAccount"))
    expect(await screen.findByText(t("admin.limits.policyLoadError"))).toBeTruthy()
    expect(screen.queryByText(/Політиці: до/)).toBeNull()
    save.mockResolvedValue({ ...retention, Custom: true })
    fireEvent.change(unitOf("InactiveAccount"), { target: { value: "days" } })
    fireEvent.change(input, { target: { value: String(5 * 365) } })
    fireEvent.click(saveButton())
    await waitFor(() => expect(save).toHaveBeenCalled())
  })

  it("asks for the Policy again on retry", async () => {
    policyGet.mockRejectedValueOnce(new Error("offline"))
    renderRetention()
    fireEvent.click(await screen.findByRole("button", { name: t("error.load.retry") }))
    await waitFor(() => expect(policyGet).toHaveBeenCalledTimes(2))
    expect(screen.queryByText(t("admin.limits.policyLoadError"))).toBeNull()
  })

  it("does not read the Policy for other cards", async () => {
    renderLeases()
    await screen.findByLabelText(label("Lease"))
    expect(policyGet).not.toHaveBeenCalled()
  })

  it("is read-only text without the write permission", async () => {
    permissions = ["platform.settings.read"]
    renderLeases()
    expect(await screen.findByText("36 год")).toBeTruthy()
    expect(screen.getByText("3 дні")).toBeTruthy()
    expect(screen.queryByRole("textbox")).toBeNull()
    expect(screen.queryByRole("button", { name: t("admin.limits.save") })).toBeNull()
    expect(screen.queryByRole("button", { name: t("admin.limits.reset") })).toBeNull()
  })

  it("tells that a saved row is ignored", async () => {
    renderLeases({ ...leases, Ignored: true })
    expect(await screen.findByText(t("admin.limits.ignored"))).toBeTruthy()
  })

  it("does not show the note when nothing is ignored", async () => {
    renderLeases()
    await screen.findByLabelText(label("Lease"))
    expect(screen.queryByText(t("admin.limits.ignored"))).toBeNull()
  })

  it("reserves the height of the loaded form while loading", () => {
    get.mockReturnValue(new Promise(() => {}))
    render(<LimitSettingsCard card="retention" title="Зберігання" labelKey={(key) => key} units={{}}
      groups={[{ titleKey: "admin.limits.group.accounts", keys: ["A", "B", "C", "D"] }, { titleKey: "admin.limits.group.sessions", keys: ["E"] }]} />)
    // (1.75 + 2 rows) + (1.75 + 1 row) rows of 6.5rem, one group gap, the buttons
    expect(screen.getByTestId("limit-reserve").style.minHeight).toBe(`${1.75 + 13 + 1.75 + 6.5 + 1.5 + 4.5}rem`)
  })

  it("shows a load error with retry", async () => {
    get.mockRejectedValueOnce(new ApiError(500, null, "x")).mockResolvedValueOnce(leases)
    render(<LimitSettingsCard card="test-runs" title="Тестові запуски" groups={[{ keys: ["Lease", "LeaseMax"] }]}
      units={{ Lease: ["hours"], LeaseMax: ["hours"] }} labelKey={(key) => `admin.limits.field.${key}`} />)
    fireEvent.click(await screen.findByRole("button", { name: t("error.load.retry") }))
    expect(await screen.findByLabelText(label("Lease"))).toHaveValue("36")
  })
})
