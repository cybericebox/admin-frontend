import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { LimitSettings } from "@/api/platformLimits"

// The real privacyPolicy module and a spy on fetch: with no retention file configured nothing is requested at all.
const get = vi.fn()
const save = vi.fn()
vi.mock("@/api/platformLimits", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/platformLimits")>()),
  getLimitSettings: (card: string) => get(card),
  saveLimitSettings: (card: string, values: unknown) => save(card, values),
  resetLimitSettings: vi.fn(),
}))
vi.mock("@/components/ui/toast", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: () => true }) }))

import { t } from "@/i18n/t"
import { LimitSettingsCard } from "./LimitSettingsCard"

const DAY = 24 * 3600
const retention: LimitSettings = {
  Custom: false, UpdatedAt: null,
  Fields: [{ Key: "InactiveAccount", Kind: "duration", Value: 3 * 365 * DAY, Default: 3 * 365 * DAY, Min: 180 * DAY, Max: 3650 * DAY, InPrivacyPolicy: true }],
}
const fetchSpy = vi.fn()

function renderRetention() {
  get.mockResolvedValue(retention)
  render(<LimitSettingsCard card="retention" title="Зберігання" groups={[{ keys: ["InactiveAccount"] }]} units={{ InactiveAccount: ["days", "years"] }} labelKey={(key) => `admin.limits.field.${key}`} />)
}

beforeEach(() => {
  fetchSpy.mockReset()
  fetchSpy.mockResolvedValue(new Response(JSON.stringify({ InactiveAccount: { value: 3, unit: "years", kind: "after" } }), { status: 200, headers: { "Content-Type": "application/json" } }))
  vi.stubGlobal("fetch", fetchSpy)
})
afterEach(() => {
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute("data-cfg-retention-url")
})

describe("the retention card without or with a retention file", () => {
  it.each([["absent", null], ["empty", ""]])("makes no request and shows no comparison, no error and no spinner when the setting is %s; the field stays editable and saves", async (_, value) => {
    if (value !== null) document.documentElement.setAttribute("data-cfg-retention-url", value)
    renderRetention()
    const input = await screen.findByLabelText(t("admin.limits.field.InactiveAccount"))
    // a few turns for any late effect
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(screen.queryByText(t("admin.limits.policyLoadError"))).toBeNull()
    expect(screen.queryByRole("status")).toBeNull()
    expect(document.querySelector("[data-policy]")).toBeNull()
    save.mockResolvedValue({ ...retention, Custom: true })
    fireEvent.change(screen.getByLabelText(t("admin.limits.unitLabel", { field: t("admin.limits.field.InactiveAccount") })), { target: { value: "days" } })
    fireEvent.change(input, { target: { value: String(5 * 365) } })
    fireEvent.click(screen.getByRole("button", { name: t("admin.limits.save") }))
    await waitFor(() => expect(save).toHaveBeenCalled())
  })

  it("fetches the configured file once, without credentials, and compares", async () => {
    document.documentElement.setAttribute("data-cfg-retention-url", "https://policy.example.org/legal/retention.json")
    renderRetention()
    await screen.findByLabelText(t("admin.limits.field.InactiveAccount"))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    expect(fetchSpy).toHaveBeenCalledWith("https://policy.example.org/legal/retention.json", { cache: "no-cache", credentials: "omit" })
  })
})
