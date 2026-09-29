import { describe, expect, it } from "vitest"

import en from "../../messages/en.json"
import uk from "../../messages/uk.json"
import { AUDIENCE_KINDS, NOTIFICATION_CHANNELS, NOTIFICATION_TYPES } from "./notifCatalog"
import { isSmtpTest, journalTypeValues, notifAudienceLabel, notifChannelLabel, notifTypeLabel, notifVariableDescription } from "./notifType"

describe("retention notification labels", () => {
  it("names the inactive account warning type", () => {
    expect(notifTypeLabel("account_inactivity_warning")).toBe("Попередження про видалення неактивного облікового запису")
  })

  it("describes the warning variables", () => {
    expect(notifVariableDescription("DeletionDate", "fallback")).toBe("Дата видалення облікового запису")
    expect(notifVariableDescription("SignInURL", "fallback")).toBe("Посилання для входу")
  })
})

describe("notification labels are fully translated", () => {
  const catalogs = { uk: uk as Record<string, string>, en: en as Record<string, string> }
  const groups = [
    { name: "signal type", prefix: "admin.notif.type.", values: NOTIFICATION_TYPES },
    { name: "recipient", prefix: "admin.notif.audience.", values: AUDIENCE_KINDS },
    { name: "channel", prefix: "admin.notif.channel.", values: NOTIFICATION_CHANNELS },
  ]

  for (const { name, prefix, values } of groups) {
    for (const [lang, messages] of Object.entries(catalogs)) {
      it(`every known ${name} has a ${lang} translation`, () => {
        const missing = values.filter((value) => !messages[prefix + value]?.trim())
        expect(missing).toEqual([])
      })
    }
  }

  it("never renders a raw key or a humanised English name for a known value", () => {
    for (const type of NOTIFICATION_TYPES) expect(notifTypeLabel(type)).not.toMatch(/^[A-Z][a-z]+( [A-Z][a-z]+)+$|[._]/)
    for (const kind of AUDIENCE_KINDS) expect(notifAudienceLabel(kind)).not.toContain("_")
    for (const channel of NOTIFICATION_CHANNELS) expect(notifChannelLabel(channel)).not.toContain("_")
    expect(notifTypeLabel("participant.event.results_published")).toBe("Результати заходу опубліковано")
    expect(notifAudienceLabel("all_participants")).toBe("Усі учасники")
  })
})

describe("SMTP test journal kind", () => {
  it("is recognised and always offered as a journal type filter", () => {
    expect(isSmtpTest("smtp_test")).toBe(true)
    expect(isSmtpTest("password_reset")).toBe(false)
    expect(journalTypeValues(["password_reset"])).toEqual(["password_reset", "smtp_test"])
    expect(journalTypeValues(["smtp_test"])).toEqual(["smtp_test"])
  })

  it("has a translated label in both catalogs", () => {
    expect(notifTypeLabel("smtp_test")).toBe("Перевірка SMTP")
    expect(en["admin.notif.type.smtp_test" as keyof typeof en]).toBeTruthy()
    expect(uk["admin.notif.logs.testBadge" as keyof typeof uk]).toBe("Тест")
  })
})
