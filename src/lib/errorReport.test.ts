import { describe, expect, it } from "vitest"
import { ApiError } from "@/api/client"
import { reference, reportHref } from "./errorReport"

const err = (rid?: string, code = 50310, status = 500) => new ApiError(status, {}, "m", undefined, code, undefined, rid)

describe("errorReport", () => {
  it("reference is code-rid8 for a 5xx with a request id only", () => {
    expect(reference(err("AB12CD34-5678"))).toBe("50310-ab12cd34")
    expect(reference(err(undefined))).toBeUndefined()
    expect(reference(err("ab12cd34", 40400, 404))).toBeUndefined()
    expect(reference(new Error("x"))).toBeUndefined()
  })

  it("reference is the request id alone when there is no platform code", () => {
    expect(reference(err("01A112DA-5678", 0))).toBe("01a112da")
    expect(reference(new ApiError(500, {}, "m", undefined, undefined, undefined, "01a112da"))).toBe("01a112da")
    const url = decodeURIComponent(reportHref(err("01a112da", 0)))
    expect(url).toContain("subject=Помилка 01a112da")
    expect(url).toContain("Номер звернення: 01a112da")
  })

  it("the mail of a server error carries the reference, no error text", () => {
    const url = decodeURIComponent(reportHref(err("ab12cd34ef"), new Date("2026-10-06T10:00:00Z")))
    expect(url).toContain("subject=Помилка 50310-ab12cd34")
    expect(url).toContain("2026-10-06T10:00:00.000Z")
    expect(url).toContain("Номер звернення: 50310-ab12cd34")
    expect(url).toContain("Що ви робили?")
  })

  it("the mail of a crash carries the message trimmed to 200 chars and the app", () => {
    const url = decodeURIComponent(reportHref(new Error("e".repeat(300))))
    expect(url).toContain("e".repeat(200))
    expect(url).not.toContain("e".repeat(201))
    expect(url).toContain("Cyber ICE Box Панель платформи")
    expect(url).not.toContain("Номер звернення")
  })
})
