import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs"

function Example() {
  return <Tabs defaultValue="a">
    <TabsList aria-label="Sections">
      <TabsTrigger value="a">First</TabsTrigger>
      <TabsTrigger value="b">Second</TabsTrigger>
      <TabsTrigger value="c">Third</TabsTrigger>
    </TabsList>
    <TabsContent value="a">Content A</TabsContent>
    <TabsContent value="b">Content B</TabsContent>
    <TabsContent value="c">Content C</TabsContent>
  </Tabs>
}

describe("Tabs", () => {
  it("uses the DS underline tabs with panels tied by aria-controls", () => {
    render(<Example />)
    const list = screen.getByRole("tablist", { name: "Sections" })
    expect(list).toHaveClass("ib-tabs")
    const first = screen.getByRole("tab", { name: "First" })
    expect(first).toHaveAttribute("aria-selected", "true")
    expect(first).toHaveAttribute("aria-controls", screen.getByRole("tabpanel").id)
    expect(screen.getByRole("tabpanel")).toHaveClass("ib-tabpanel")
  })

  it("arrows, Home and End move focus and selection together", async () => {
    render(<Example />)
    screen.getByRole("tab", { name: "First" }).focus()
    fireEvent.keyDown(screen.getByRole("tab", { name: "First" }), { key: "ArrowRight" })
    await waitFor(() => expect(screen.getByRole("tab", { name: "Second" })).toHaveFocus())
    expect(screen.getByRole("tab", { name: "Second" })).toHaveAttribute("aria-selected", "true")
    fireEvent.keyDown(screen.getByRole("tab", { name: "Second" }), { key: "End" })
    await waitFor(() => expect(screen.getByRole("tab", { name: "Third" })).toHaveAttribute("aria-selected", "true"))
    fireEvent.keyDown(screen.getByRole("tab", { name: "Third" }), { key: "Home" })
    await waitFor(() => expect(screen.getByRole("tab", { name: "First" })).toHaveAttribute("aria-selected", "true"))
    fireEvent.keyDown(screen.getByRole("tab", { name: "First" }), { key: "ArrowRight" })
    await waitFor(() => expect(screen.getByRole("tab", { name: "Second" })).toHaveAttribute("aria-selected", "true"))
    // Roving tabindex: only the selected tab is a Tab stop.
    expect(screen.getByRole("tab", { name: "First" })).toHaveAttribute("tabindex", "-1")
  })

  it("the vertical variant drops the horizontal scroll hook", () => {
    render(<Tabs defaultValue="a"><TabsList variant="vertical" aria-label="Settings"><TabsTrigger value="a">Only</TabsTrigger></TabsList></Tabs>)
    expect(screen.getByRole("tablist")).toHaveClass("ib-tabs--vertical")
    expect(screen.getByRole("tablist")).not.toHaveClass("ib-tabs--scroll")
    fireEvent.click(screen.getByRole("tab", { name: "Only" }))
  })
})
