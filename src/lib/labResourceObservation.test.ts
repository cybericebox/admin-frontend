import { describe, expect, it } from "vitest"
import { managedGroup, managedLab } from "@/test/labLifecycle"
import { currentObservation, decimalCpu, decimalMemory } from "./labResourceObservation"

describe("managed resource observations", () => {
  it("requires matching revision, agent identity and observation time for labs and groups", () => {
    for (const value of [managedLab, managedGroup]) {
      expect(currentObservation(value)).toBe(false)
      expect(currentObservation({ ...value, ObservedRevision: "12" })).toBe(true)
      expect(currentObservation({ ...value, ObservedRevision: "12", AgentUID: "" })).toBe(false)
      expect(currentObservation({ ...value, ObservedRevision: "12", ObservedAt: null })).toBe(false)
    }
  })

  it("formats familiar quantities but retains every digit when units would round", () => {
    expect(decimalCpu("250")).toBe("250 мілі-ядер")
    expect(decimalCpu("1250")).toBe("1,25 vCPU")
    expect(decimalCpu("1001")).toBe("1 001 mCPU")
    expect(decimalMemory("104857600")).toBe("100 МіБ")
    expect(decimalMemory("104857601")).toBe("104 857 601 Б")
    expect(decimalMemory("9007199254740993")).toBe("9 007 199 254 740 993 Б")
    expect(decimalCpu("9007199254740993")).toBe("9 007 199 254 740 993 mCPU")
    expect(decimalMemory("0")).toBe("0 Б")
  })
})
