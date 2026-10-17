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
    get.mockReset(); save.mockReset(); reset.mockReset(); toastError.mockReset()
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
    await waitFor(() => expect(within(block).getByRole("alert")).toBeTruthy())
    expect(toastError).not.toHaveBeenCalled()
  })

  it("renders a server range error with the field's units", async () => {
    renderLeases()
    fireEvent.change(await screen.findByLabelText(label("Lease")), { target: { value: "5" } })
    save.mockRejectedValue(new ApiError(400, { Status: { Code: 20104, Context: { field: "Lease", min: HOUR, max: 7 * DAY } } }, "x", undefined, 20104))
    fireEvent.click(saveButton())
    const block = document.querySelector('[data-field="Lease"]') as HTMLElement
    await waitFor(() => expect(within(block).getByRole("alert").textContent).toBe(t("admin.limits.error.range", { min: "1 год", max: "7 днів" })))
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

  it("marks only fields published in the privacy policy", async () => {
    renderRetention()
    await screen.findByLabelText(label("InactiveAccount"))
    const note = t("admin.limits.inPrivacyPolicy")
    expect(within(document.querySelector('[data-field="InactiveAccount"]') as HTMLElement).getByText(note)).toBeTruthy()
    expect(within(document.querySelector('[data-field="InactivityGrace"]') as HTMLElement).queryByText(note)).toBeNull()
    expect(screen.getByText(t("admin.limits.group.accounts"))).toBeTruthy()
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

  it("shows a load error with retry", async () => {
    get.mockRejectedValueOnce(new ApiError(500, null, "x")).mockResolvedValueOnce(leases)
    render(<LimitSettingsCard card="test-runs" title="Тестові запуски" groups={[{ keys: ["Lease", "LeaseMax"] }]}
      units={{ Lease: ["hours"], LeaseMax: ["hours"] }} labelKey={(key) => `admin.limits.field.${key}`} />)
    fireEvent.click(await screen.findByRole("button", { name: t("error.load.retry") }))
    expect(await screen.findByLabelText(label("Lease"))).toHaveValue("36")
  })
})
