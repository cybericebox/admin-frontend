import { describe, expect, it } from "vitest"
import { groupListPath, parseReference } from "./errorJournal"

describe("parseReference", () => {
  it("takes the request id out of «code-rid8» or a bare id, lower case", () => {
    expect(parseReference("50310-a1b2c3d4")).toBe("a1b2c3d4")
    expect(parseReference("  50310-A1B2C3D4 ")).toBe("a1b2c3d4")
    expect(parseReference("a1b2c3d4")).toBe("a1b2c3d4")
    expect(parseReference("a1b2c3d4e5f6")).toBe("a1b2c3d4e5f6")
  })
  it("rejects anything that is not 8+ hex digits", () => {
    expect(parseReference("")).toBeUndefined()
    expect(parseReference("50310-a1b2c3")).toBeUndefined()
    expect(parseReference("50310-zzzzzzzz")).toBeUndefined()
  })
})

describe("groupListPath", () => {
  it("sends request next to the other filters", () => {
    const path = groupListPath({ kinds: ["panic"], status: "", q: "", request: "a1b2c3d4" }, 50, 0)
    expect(path).toContain("request=a1b2c3d4")
    expect(path).toContain("kind=panic")
    expect(groupListPath({ kinds: [], status: "", q: "" }, 50, 0)).not.toContain("request")
  })
})
