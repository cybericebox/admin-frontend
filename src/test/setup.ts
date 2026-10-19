import { vi } from "vitest"
import "@testing-library/jest-dom/vitest"

// jsdom has no canvas: the design system chart theme reads colours through one and falls back to the raw value.
if (typeof HTMLCanvasElement !== "undefined") HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement["getContext"]

// The chart locale module loads the whole of echarts; page tests mock echarts-for-react and never need it
// (echartsLocale.test.ts unmocks it to check the Ukrainian month names).
vi.mock("@/components/analytics/echartsLocale", () => ({}))
