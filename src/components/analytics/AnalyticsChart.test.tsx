import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { AnalyticsChart } from "./AnalyticsChart"
import { lineOption } from "./chartOptions"

vi.mock("echarts-for-react", () => ({ default: ({ option }: { option: { series: unknown[] } }) => <div data-testid="echart">{option.series.length} series</div> }))

describe("AnalyticsChart", () => {
  it("shows the crest inside the block while loading and keeps the height", () => {
    const { container } = render(<AnalyticsChart loading ariaLabel="chart" height={300} />)
    expect(screen.getByRole("status")).toBeInTheDocument()
    expect((container.firstChild as HTMLElement).style.height).toBe("300px")
  })
  it("shows LoadError with retry on error", () => {
    const onRetry = vi.fn()
    render(<AnalyticsChart error={new Error("x")} ariaLabel="chart" onRetry={onRetry} />)
    screen.getByRole("button", { name: "Спробувати ще раз" }).click()
    expect(onRetry).toHaveBeenCalledOnce()
  })
  it("shows the empty state", () => {
    const { container } = render(<AnalyticsChart empty ariaLabel="chart" />)
    expect(container.querySelector("[data-empty-state]")).not.toBeNull()
    expect(screen.getByText("Немає даних за цей період")).toBeInTheDocument()
  })
  it("renders the option once ready, also as a function of the theme", async () => {
    render(<AnalyticsChart ariaLabel="chart" option={(theme) => lineOption([{ name: "a", data: [[1, 2]] }], { theme })} />)
    expect(await screen.findByTestId("echart")).toHaveTextContent("1 series")
  })
})
