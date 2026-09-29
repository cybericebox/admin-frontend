import { describe, expect, it } from "vitest"

import { notifTypeLabel, notifVariableDescription } from "./notifType"

describe("retention notification labels", () => {
  it("names the inactive account warning type", () => {
    expect(notifTypeLabel("account_inactivity_warning")).toBe("Попередження про видалення неактивного облікового запису")
  })

  it("describes the warning variables", () => {
    expect(notifVariableDescription("DeletionDate", "fallback")).toBe("Дата видалення облікового запису")
    expect(notifVariableDescription("SignInURL", "fallback")).toBe("Посилання для входу")
  })
})
