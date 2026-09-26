/**
 * SignalDefaultsSection.test.tsx — TDD RED→GREEN
 *
 * Covers:
 *  - Renders one row per Event-scoped signal type, with a human label via i18n
 *    (falls back to a humanized raw type for an untranslated one)
 *  - Renders an Email and an In-app switch per row, reflecting Enabled
 *  - Toggling a switch calls updateSignalDefault with the same Audience and
 *    the flipped Enabled
 *  - Switches are disabled when the caller lacks notifications.settings.write
 *  - Audience renders read-only as localized text (not editable)
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import uk from "../../../messages/uk.json"
import type { SignalDefault } from "@/api/notifications/signalDefaults"

// ── Mocks ──────────────────────────────────────────────────────────────────

const api = vi.hoisted(() => ({ list: vi.fn(), update: vi.fn() }))
vi.mock("@/api/notifications/signalDefaults", () => ({
  listSignalDefaults: api.list,
  updateSignalDefault: api.update,
}))

const role = vi.hoisted(() => ({ can: vi.fn(() => true) }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: role.can }) }))

import { SignalDefaultsSection } from "./SignalDefaultsSection"

// ── Fixtures ─────────────────────────────────────────────────────────────────

const enrolledEmail: SignalDefault = {
  SignalType: "participant.enrolled",
  Channel: "email",
  Enabled: false,
  Audience: { kind: "signal_subject" },
}
const enrolledInApp: SignalDefault = {
  SignalType: "participant.enrolled",
  Channel: "in_app",
  Enabled: true,
  Audience: { kind: "signal_subject" },
}
// A signal type with no translation in the catalog, to prove the raw-type
// fallback path (formatted, not the untranslated i18n key).
const untranslatedEmail: SignalDefault = {
  SignalType: "participant.made_up_signal",
  Channel: "email",
  Enabled: false,
  Audience: { kind: "unmapped_kind" },
}

const uk_ = uk as Record<string, string>

describe("SignalDefaultsSection", () => {
  beforeEach(() => {
    api.list.mockReset()
    api.update.mockReset()
    role.can.mockReset()
    role.can.mockReturnValue(true)
  })

  it("lists each signal with human labels, per-channel switches and read-only audience", async () => {
    api.list.mockResolvedValue([enrolledEmail, enrolledInApp, untranslatedEmail])
    render(<SignalDefaultsSection />)

    // Translated label for a known type.
    expect(await screen.findByText(uk_["admin.notif.type.participant.enrolled"])).toBeInTheDocument()
    // Fallback humanized label for an untranslated type.
    expect(screen.getByText("Participant Made Up Signal")).toBeInTheDocument()

    // Two switches for the translated row (email off, in_app on).
    const emailSwitch = screen.getByRole("switch", {
      name: `${uk_["admin.notif.type.participant.enrolled"]} — ${uk_["admin.notif.channel.email"]}`,
    })
    const inAppSwitch = screen.getByRole("switch", {
      name: `${uk_["admin.notif.type.participant.enrolled"]} — ${uk_["admin.notif.channel.in_app"]}`,
    })
    expect(emailSwitch).toHaveAttribute("aria-checked", "false")
    expect(inAppSwitch).toHaveAttribute("aria-checked", "true")

    // Audience shown read-only as localized text, not a raw kind string.
    expect(screen.getByText(uk_["admin.notif.audience.signal_subject"])).toBeInTheDocument()
    // Unmapped audience kind falls back to the raw kind.
    expect(screen.getByText("unmapped_kind")).toBeInTheDocument()
  })

  it("toggling a switch calls updateSignalDefault with the same Audience and flipped Enabled", async () => {
    api.list.mockResolvedValue([enrolledEmail, enrolledInApp])
    api.update.mockResolvedValue({ ...enrolledEmail, Enabled: true })
    render(<SignalDefaultsSection />)

    const emailSwitch = await screen.findByRole("switch", {
      name: `${uk_["admin.notif.type.participant.enrolled"]} — ${uk_["admin.notif.channel.email"]}`,
    })
    emailSwitch.click()

    await waitFor(() => expect(api.update).toHaveBeenCalledWith({
      SignalType: "participant.enrolled",
      Channel: "email",
      Enabled: true,
      Audience: { kind: "signal_subject" },
    }))
  })

  it("disables switches without notifications.settings.write", async () => {
    role.can.mockReturnValue(false)
    api.list.mockResolvedValue([enrolledEmail, enrolledInApp])
    render(<SignalDefaultsSection />)

    const emailSwitch = await screen.findByRole("switch", {
      name: `${uk_["admin.notif.type.participant.enrolled"]} — ${uk_["admin.notif.channel.email"]}`,
    })
    expect(emailSwitch).toBeDisabled()
    expect(role.can).toHaveBeenCalledWith("notifications.settings.write")
  })
})
