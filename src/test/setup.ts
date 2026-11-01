import { vi } from "vitest"
import "@testing-library/jest-dom/vitest"
import { configure } from "@testing-library/react"

// waitFor / findBy wait for a condition, not for a time: the limit only has to outlast a loaded machine (the default 1 s fails when many test files run at once).
configure({ asyncUtilTimeout: 10000 })

// jsdom has no canvas: the design system chart theme reads colours through one and falls back to the raw value.
if (typeof HTMLCanvasElement !== "undefined") HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement["getContext"]

// The chart locale module loads the whole of echarts; page tests mock echarts-for-react and never need it
// (echartsLocale.test.ts unmocks it to check the Ukrainian month names).
vi.mock("@/components/analytics/echartsLocale", () => ({}))
