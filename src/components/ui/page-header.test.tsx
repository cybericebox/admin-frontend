import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { PageTitleContext } from "@/components/shell/PageTitle"
import { Badge } from "./badge"
import { Breadcrumbs } from "./breadcrumbs"
import { PageHeader } from "./page-header"

vi.mock("@/i18n/t", () => ({ t: (key: string) => key }))
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }))

describe("PageHeader", () => {
  it("owns the page's only h1 with count, sub line, actions and crumbs", () => {
    render(<PageHeader title="Заходи" count={12} sub="Усі заходи платформи" actions={<button>Створити</button>} crumbs={[{ label: "Панель", href: "/dashboard" }, { label: "Заходи" }]} />)
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Заходи12")
    expect(screen.getByText("Усі заходи платформи")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Створити" })).toBeInTheDocument()
    expect(screen.getByRole("navigation", { name: "ui.breadcrumbs" })).toBeInTheDocument()
  })

  it("reports a string title to the shell for the document title and clears it on unmount", () => {
    const set = vi.fn()
    const { unmount } = render(<PageTitleContext.Provider value={set}><PageHeader title="Spring CTF" /></PageTitleContext.Provider>)
    expect(set).toHaveBeenLastCalledWith("Spring CTF")
    unmount()
    expect(set).toHaveBeenLastCalledWith(null)
  })
})

describe("Breadcrumbs", () => {
  it("links every item but the last, which is the current page", () => {
    render(<Breadcrumbs items={[{ label: "Заходи", href: "/events" }, { label: "Spring CTF" }]} />)
    expect(screen.getByRole("link", { name: "Заходи" })).toHaveAttribute("href", "/events")
    expect(screen.getByText("Spring CTF")).toHaveAttribute("aria-current", "page")
    expect(screen.queryByRole("link", { name: "Spring CTF" })).not.toBeInTheDocument()
  })
})

describe("Badge", () => {
  it("maps tones and sizes to the DS tag classes", () => {
    render(<><Badge tone="ok">Активний</Badge><Badge tone="danger" size="sm">Заблоковано</Badge><Badge>Чернетка</Badge></>)
    expect(screen.getByText("Активний")).toHaveClass("ib-tag", "ib-tag--ok")
    expect(screen.getByText("Заблоковано")).toHaveClass("ib-tag--danger", "ib-tag--sm")
    expect(screen.getByText("Чернетка")).toHaveClass("ib-tag")
  })
})
