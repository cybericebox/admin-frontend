import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, waitFor } from "@testing-library/react"

const mocks = vi.hoisted(() => ({ apiGet: vi.fn() }))
vi.mock("@/api/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/api/client")>()), apiGet: mocks.apiGet }))
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("period=30d"),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/analytics",
}))
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }))
vi.mock("echarts-for-react", () => ({ default: () => <div data-testid="echart" /> }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: () => true }) }))

import Overview from "./page"
import Users from "./users/page"
import Events from "./events/page"
import Tasks from "./tasks/page"
import Infrastructure from "./infrastructure/page"
import Notifications from "./notifications/page"

const pages = { overview: Overview, users: Users, events: Events, tasks: Tasks, infrastructure: Infrastructure, notifications: Notifications }

// The backend may answer with nothing for a part of a report (empty data, an older daemon): the page shows its
// empty states, never an error screen.
describe.each(Object.entries(pages))("analytics %s with an empty report", (_name, Page) => {
  beforeEach(() => { mocks.apiGet.mockReset() })

  it.each([["{}", {}], ["null parts", { Period: null, Series: null }], ["empty lists", { Items: [], Total: 0 }]])("renders for %s", async (_label, payload) => {
    mocks.apiGet.mockResolvedValue(payload)
    const errors: unknown[] = []
    const spy = vi.spyOn(console, "error").mockImplementation((...args) => { errors.push(args) })
    const { container } = render(<Page />)
    await waitFor(() => expect(mocks.apiGet).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 50))
    spy.mockRestore()
    expect(container.textContent?.length).toBeGreaterThan(0)
    expect(errors.filter((e) => String(e).includes("TypeError"))).toEqual([])
  })
})
