import { describe, expect, it } from "vitest"
import { standReasonText } from "./standReason"

describe("standReasonText", () => {
  it("reads «ImageUnavailable: <image>» as a sentence with the image", () => {
    expect(standReasonText("ImageUnavailable: acme/web:1")).toBe("Образ недоступний: acme/web:1")
  })

  it("reads a bare ImageUnavailable as «Образ недоступний»", () => {
    expect(standReasonText("ImageUnavailable")).toBe("Образ недоступний")
  })

  it("keeps any other reason as it is", () => {
    expect(standReasonText("pull denied")).toBe("pull denied")
  })
})
