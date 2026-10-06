import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs"

function Example() {
  return <Tabs defaultValue="a">
    <TabsList aria-label="Розділи">
      <TabsTrigger value="a">Перша</TabsTrigger>
      <TabsTrigger value="b">Друга</TabsTrigger>
      <TabsTrigger value="c">Третя</TabsTrigger>
    </TabsList>
    <TabsContent value="a">Вміст А</TabsContent>
    <TabsContent value="b">Вміст Б</TabsContent>
    <TabsContent value="c">Вміст В</TabsContent>
  </Tabs>
}

describe("Tabs", () => {
  it("uses the DS underline tabs with panels tied by aria-controls", () => {
    render(<Example />)
    const list = screen.getByRole("tablist", { name: "Розділи" })
    expect(list).toHaveClass("ib-tabs")
    const first = screen.getByRole("tab", { name: "Перша" })
    expect(first).toHaveAttribute("aria-selected", "true")
    expect(first).toHaveAttribute("aria-controls", screen.getByRole("tabpanel").id)
    expect(screen.getByRole("tabpanel")).toHaveClass("ib-tabpanel")
  })

  it("arrows, Home and End move focus and selection together", async () => {
    render(<Example />)
    screen.getByRole("tab", { name: "Перша" }).focus()
    fireEvent.keyDown(screen.getByRole("tab", { name: "Перша" }), { key: "ArrowRight" })
    await waitFor(() => expect(screen.getByRole("tab", { name: "Друга" })).toHaveFocus())
    expect(screen.getByRole("tab", { name: "Друга" })).toHaveAttribute("aria-selected", "true")
    fireEvent.keyDown(screen.getByRole("tab", { name: "Друга" }), { key: "End" })
    await waitFor(() => expect(screen.getByRole("tab", { name: "Третя" })).toHaveAttribute("aria-selected", "true"))
    fireEvent.keyDown(screen.getByRole("tab", { name: "Третя" }), { key: "Home" })
    await waitFor(() => expect(screen.getByRole("tab", { name: "Перша" })).toHaveAttribute("aria-selected", "true"))
    fireEvent.keyDown(screen.getByRole("tab", { name: "Перша" }), { key: "ArrowRight" })
    await waitFor(() => expect(screen.getByRole("tab", { name: "Друга" })).toHaveAttribute("aria-selected", "true"))
    // Roving tabindex: only the selected tab is a Tab stop.
    expect(screen.getByRole("tab", { name: "Перша" })).toHaveAttribute("tabindex", "-1")
  })

  it("the vertical variant drops the horizontal scroll hook", () => {
    render(<Tabs defaultValue="a"><TabsList variant="vertical" aria-label="Налаштування"><TabsTrigger value="a">А</TabsTrigger></TabsList></Tabs>)
    expect(screen.getByRole("tablist")).toHaveClass("ib-tabs--vertical")
    expect(screen.getByRole("tablist")).not.toHaveClass("ib-tabs--scroll")
    fireEvent.click(screen.getByRole("tab", { name: "А" }))
  })
})
