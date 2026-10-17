import { describe, it, expect } from "vitest"
import { ApiError } from "@/api/client"
import { errorOr, formatWait, localizedError } from "./apiError"
import { t } from "./t"
import en from "../../messages/en.json"
import uk from "../../messages/uk.json"

describe("localizedError", () => {
  it("shows the Retry-After wait on a 429", () => {
    const err = new ApiError(429, null, "x", undefined, 70428, 90)
    expect(localizedError(err)).toBe(t("error.rateLimited", { wait: formatWait(90) }))
    expect(formatWait(90)).toBe(t("error.wait.minutes", { count: 2 }))
  })

  it("answers a bare 429 without Retry-After with the generic wait message", () => {
    expect(localizedError(new ApiError(429, null))).toBe(t("error.rateLimitedNoWait"))
  })

  it("answers a 503 with the overloaded message", () => {
    expect(localizedError(new ApiError(503, null))).toBe(t("error.overloaded"))
    expect(localizedError(new ApiError(503, null, "x", undefined, 10503))).toBe(t("error.overloaded"))
    // A domain 503 with a catalog code keeps its own message.
    expect(localizedError(new ApiError(503, null, "x", undefined, 20225))).not.toBe(t("error.overloaded"))
    expect(uk["error.overloaded"]).toBe("Сервер перевантажений, спробуйте за кілька секунд")
    expect(en["error.overloaded"]).toBe("The server is overloaded, try again in a few seconds")
    expect(uk["error.overloaded.retry"]).toBe("Спробувати ще раз")
    expect(en["error.overloaded.retry"]).toBe("Try again")
  })

  it("maps the new codes through the catalog", () => {
    for (const code of [20225, 20427, 60429, 70428]) {
      expect(localizedError(new ApiError(400, null, "x", undefined, code))).not.toBe(t("error.generic"))
    }
  })

  it("errorOr falls back for unknown errors", () => {
    expect(errorOr(new Error("boom"), "fallback")).toBe("fallback")
    expect(errorOr(new ApiError(400, null, "x", undefined, 20225), "fallback")).not.toBe("fallback")
  })
})
