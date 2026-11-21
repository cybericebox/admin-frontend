import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { PageTitleContext } from "@/components/shell/PageTitle"
import { Badge } from "./badge"
import { Breadcrumbs } from "./breadcrumbs"
import { PageHeader } from "./page-header"

vi.mock("@/i18n/t", () => ({ t: (key: string) => key }))
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }))

describe("PageHeader", () => {
  it("owns the page's only h1 with count, sub line and actions", () => {
    render(<PageHeader title="Events" count={12} sub="All events of the platform" actions={<button>Create</button>} />)
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Events12")
    expect(screen.getByText("All events of the platform")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument()
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument()
  })

  it("reports a string title to the shell for the document title and clears it on unmount", () => {
    const set = vi.fn()
    const { unmount } = render(<PageTitleContext.Provider value={set}><PageHeader title="Spring CTF" /></PageTitleContext.Provider>)
    expect(set).toHaveBeenLastCalledWith({ title: "Spring CTF", crumbs: null })
    unmount()
    expect(set).toHaveBeenLastCalledWith(null)
  })

  it("hands its crumbs to the shell instead of drawing them", () => {
    const set = vi.fn()
    render(<PageTitleContext.Provider value={set}><PageHeader title="Spring CTF" crumbs={[{ label: "Events", href: "/events" }, { label: "Spring CTF" }]} /></PageTitleContext.Provider>)
    expect(set).toHaveBeenLastCalledWith({ title: "Spring CTF", crumbs: [{ label: "Events", href: "/events" }, { label: "Spring CTF" }] })
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument()
  })
})

describe("Breadcrumbs", () => {
  it("links every item but the last, which is the current page", () => {
    render(<Breadcrumbs items={[{ label: "Events", href: "/events" }, { label: "Spring CTF" }]} />)
    expect(screen.getByRole("link", { name: "Events" })).toHaveAttribute("href", "/events")
    expect(screen.getByText("Spring CTF")).toHaveAttribute("aria-current", "page")
    expect(screen.queryByRole("link", { name: "Spring CTF" })).not.toBeInTheDocument()
  })
})

describe("Badge", () => {
  it("maps tones and sizes to the DS tag classes", () => {
    render(<><Badge tone="ok">Active</Badge><Badge tone="danger" size="sm">Blocked</Badge><Badge>Draft</Badge></>)
    expect(screen.getByText("Active")).toHaveClass("ib-tag", "ib-tag--ok")
    expect(screen.getByText("Blocked")).toHaveClass("ib-tag--danger", "ib-tag--sm")
    expect(screen.getByText("Draft")).toHaveClass("ib-tag")
  })
})
