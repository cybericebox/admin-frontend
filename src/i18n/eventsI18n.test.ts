/**
 * eventsI18n.test.ts — parity guard for the admin.events* key namespace.
 * (1) en.json and uk.json carry the SAME admin.events* key sets;
 * (2) every error-dictionary key resolves in both catalogs;
 * (3) no admin.events* value is blank.
 */
import { describe, it, expect } from "vitest"
import en from "../../messages/en.json"
import uk from "../../messages/uk.json"
import { CODE_TO_KEY } from "@/lib/eventErrors"

const evKeys = (cat: Record<string, string>) =>
  Object.keys(cat).filter((k) => k.startsWith("admin.events")).sort()

describe("admin.events* i18n parity", () => {
  it("en and uk define the same admin.events* keys", () => {
    const enKeys = evKeys(en as Record<string, string>)
    const ukKeys = evKeys(uk as Record<string, string>)
    expect(ukKeys).toEqual(enKeys)
    expect(enKeys.length).toBeGreaterThan(0)
  })

  it("every error-dictionary key exists in both catalogs", () => {
    for (const key of Object.values(CODE_TO_KEY)) {
      expect((en as Record<string, string>)[key], `en missing ${key}`).toBeTruthy()
      expect((uk as Record<string, string>)[key], `uk missing ${key}`).toBeTruthy()
    }
  })

  it("no admin.events* value is blank", () => {
    for (const cat of [en, uk] as Record<string, string>[]) {
      for (const k of evKeys(cat)) expect(cat[k].trim(), `blank value for ${k}`).not.toBe("")
    }
  })
})
