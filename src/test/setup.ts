import "@testing-library/jest-dom/vitest"

// jsdom has no canvas: the design system chart theme reads colours through one and falls back to the raw value.
if (typeof HTMLCanvasElement !== "undefined") HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement["getContext"]
