import { describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { FormProvider, useForm, useFormContext, useWatch } from "react-hook-form"

vi.mock("@/i18n/t", () => ({ t: (key: string) => key }))

import { TopologySection } from "./TopologySection"
import { emptyDraft, type DraftFormValues } from "@/lib/exerciseSchemas"

function Snapshot() {
  const { control } = useFormContext<DraftFormValues>()
  const topology = useWatch({ control, name: "Variants.0.Topology" })
  return <output data-testid="topology-snapshot">{JSON.stringify(topology)}</output>
}

function Harness() {
  const form = useForm<DraftFormValues>({ defaultValues: emptyDraft() })
  return <FormProvider {...form}><TopologySection variantIndex={0} disabled={false} /><Snapshot /></FormProvider>
}

function topology() {
  return JSON.parse(screen.getByTestId("topology-snapshot").textContent ?? "{}") as DraftFormValues["Variants"][number]["Topology"]
}

function addNode(name: "container" | "switch" | "hub" | "vpn" | "internet") {
  fireEvent.keyDown(screen.getByRole("button", { name: "admin.exTopo.addDevice" }), { key: "ArrowDown" })
  fireEvent.click(screen.getByRole("menuitem", { name: name === "vpn" || name === "internet" ? `admin.exTopo.${name}` : `admin.exTopo.type.${name}` }))
}

function diagram() {
  return screen.getByRole("img", { name: "admin.exTopo.diagram" })
}

describe("topology workspace", () => {
  it("expands the canvas to the viewport and restores the editor layout", () => {
    render(<Harness />)
    const workspace = screen.getByTestId("topology-workspace")
    fireEvent.click(screen.getByRole("button", { name: "admin.exTopo.expandCanvas" }))
    expect(workspace).toHaveClass("fixed")
    expect(workspace).toHaveClass("inset-0")
    expect(diagram()).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "admin.exTopo.collapseCanvas" }))
    expect(workspace).not.toHaveClass("fixed")
    expect(diagram()).toBeInTheDocument()
  })

  it("saves a dragged node label separately from its icon position", () => {
    render(<Harness />)
    addNode("container")
    const nodeId = topology().Devices[0].ID
    const svg = diagram()
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 960, height: 560 } as DOMRect)
    const label = within(svg).getByText("host-1", { selector: "text" })
    const x = Number(label.getAttribute("x"))
    const y = Number(label.getAttribute("y"))
    fireEvent(label, new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: x, clientY: y }))
    fireEvent(svg, new MouseEvent("pointermove", { bubbles: true, clientX: x + 30, clientY: y - 12 }))
    fireEvent(svg, new MouseEvent("pointerup", { bubbles: true, clientX: x + 30, clientY: y - 12 }))
    const visual = topology().VisualRender as { labelOffsets?: Record<string, unknown>; positions?: Record<string, unknown> } | null
    expect(visual?.labelOffsets).toHaveProperty(nodeId)
    expect(visual?.positions?.[nodeId]).toBeUndefined()
  })

  it("uses separate diagram, device and connection screens", () => {
    render(<Harness />)
    expect(diagram()).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "admin.exTopo.devices" }))
    expect(screen.queryByRole("img", { name: "admin.exTopo.diagram" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "admin.exTopo.connections" }))
    expect(screen.getByText("admin.exTopo.noConnections")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "admin.exTopo.diagram" }))
    expect(diagram()).toBeInTheDocument()
  })

  it("creates the selected device immediately, then edits it inline from the list", () => {
    render(<Harness />)
    addNode("container")
    expect(topology().Devices[0].Name).toBe("host-1")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "admin.exTopo.devices" }))
    fireEvent.click(screen.getByRole("button", { name: "host-1" }))
    fireEvent.click(screen.getByRole("button", { name: "admin.exTopo.basic" }))
    expect(screen.getByPlaceholderText("web-01")).toHaveValue("host-1")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("keeps toolbar-created devices in distinct positions after the first three rows", () => {
    render(<Harness />)
    for (let index = 0; index < 13; index++) addNode("container")
    const points = Array.from(diagram().querySelectorAll('[data-icon-hitbox]')).map((rect) =>
      `${rect.getAttribute("x")},${rect.getAttribute("y")}`)
    expect(points).toHaveLength(13)
    expect(new Set(points).size).toBe(13)
  })

  it("adds nodes from the empty-canvas menu and starts a connection from the source node menu", () => {
    render(<Harness />)
    fireEvent.contextMenu(diagram(), { clientX: 280, clientY: 190 })
    fireEvent.click(screen.getByRole("menuitem", { name: "admin.exTopo.type.container" }))
    fireEvent.contextMenu(diagram(), { clientX: 600, clientY: 300 })
    fireEvent.click(screen.getByRole("menuitem", { name: "admin.exTopo.type.switch" }))
    expect(topology().Devices).toHaveLength(2)
    expect(topology().VisualRender?.positions).toHaveProperty(topology().Devices[0].ID)
    expect(screen.queryByRole("button", { name: "admin.exTopo.configure" })).not.toBeInTheDocument()
    fireEvent.contextMenu(within(diagram()).getByRole("button", { name: "host-1" }))
    fireEvent.click(screen.getByRole("menuitem", { name: "admin.exTopo.addConnection" }))
    fireEvent.click(within(diagram()).getByRole("button", { name: "sw-1" }))
    expect(screen.getByRole("dialog", { name: "admin.exTopo.canvasConnect" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "admin.exTopo.canvasConnect" }))
    expect(topology().Connections).toHaveLength(1)
  })

  it("connects two containers from the canvas using each device's eth0", () => {
    render(<Harness />)
    addNode("container")
    addNode("container")
    fireEvent.contextMenu(within(diagram()).getByRole("button", { name: "host-1" }))
    fireEvent.click(screen.getByRole("menuitem", { name: "admin.exTopo.addConnection" }))
    fireEvent.click(within(diagram()).getByRole("button", { name: "host-2" }))
    expect(topology().Connections).toHaveLength(0)
    const modal = screen.getByRole("dialog", { name: "admin.exTopo.canvasConnect" })
    expect(within(modal).getAllByText(/eth0/).length).toBeGreaterThanOrEqual(2)
    fireEvent.click(within(modal).getByRole("button", { name: "admin.exTopo.canvasConnect" }))
    expect(topology().Connections).toHaveLength(1)
    expect(topology().Connections[0].Endpoints).toEqual([
      { Kind: "device", DeviceID: topology().Devices[0].ID, Interface: "eth0" },
      { Kind: "device", DeviceID: topology().Devices[1].ID, Interface: "eth0" },
    ])
    expect(diagram().querySelector('[data-edge="e0"]')).toBeInTheDocument()
  })

  it("keeps the 48-port switch picker inside a compact scrollable menu", () => {
    render(<Harness />)
    addNode("container")
    addNode("switch")
    fireEvent.contextMenu(within(diagram()).getByRole("button", { name: "host-1" }))
    fireEvent.click(screen.getByRole("menuitem", { name: "admin.exTopo.addConnection" }))
    fireEvent.click(within(diagram()).getByRole("button", { name: "sw-1" }))
    const modal = screen.getByRole("dialog", { name: "admin.exTopo.canvasConnect" })
    expect(modal).toHaveClass("max-w-md")
    fireEvent.keyDown(within(modal).getByRole("button", { name: "admin.exTopo.endpoint.second" }), { key: "ArrowDown" })
    const picker = screen.getByRole("menu")
    expect(picker).toHaveClass("overflow-y-auto")
    expect(picker).toHaveClass("max-h-60")
    expect(within(picker).getAllByRole("menuitemradio")).toHaveLength(48)
  })

  it("keeps selection when switching screens, while canvas configuration opens a side panel", () => {
    render(<Harness />)
    addNode("container")
    fireEvent.click(screen.getByRole("button", { name: "admin.exTopo.devices" }))
    expect(screen.getByRole("button", { name: "host-1" })).toHaveAttribute("aria-current", "page")
    fireEvent.click(screen.getByRole("button", { name: "admin.exTopo.diagram" }))
    const host = within(diagram()).getByRole("button", { name: "host-1" })
    fireEvent.keyDown(host, { key: "F10", shiftKey: true })
    fireEvent.click(screen.getByRole("menuitem", { name: "admin.exTopo.configure" }))
    expect(screen.getByRole("complementary", { name: "admin.exTopo.deviceSettings" })).toBeInTheDocument()
    expect(screen.getByTestId("topology-canvas-layout")).toHaveClass("xl:flex-row")
    expect(screen.getByTestId("topology-canvas-layout")).toContainElement(diagram())
    fireEvent.click(screen.getByRole("button", { name: "admin.exTopo.icon.firewall" }))
    expect(topology().VisualRender?.icons).toEqual({ [topology().Devices[0].ID]: "firewall" })
    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByRole("complementary", { name: "admin.exTopo.deviceSettings" })).not.toBeInTheDocument()
    fireEvent.keyDown(host, { key: "F10", shiftKey: true })
    fireEvent.click(screen.getByRole("menuitem", { name: "admin.exTopo.configure" }))
    fireEvent.click(diagram().querySelector('[data-canvas-background]')!)
    expect(screen.queryByRole("complementary", { name: "admin.exTopo.deviceSettings" })).not.toBeInTheDocument()
  })

  it("creates one VPN node and exposes only DHCP in its configuration", () => {
    render(<Harness />)
    addNode("vpn")
    expect(topology().VPN.Enabled).toBe(true)
    fireEvent.contextMenu(within(diagram()).getByRole("button", { name: "admin.exTopo.vpn" }))
    fireEvent.click(screen.getByRole("menuitem", { name: "admin.exTopo.configure" }))
    const panel = screen.getByRole("complementary", { name: "admin.exTopo.vpn" })
    expect(panel).toHaveClass("xl:min-w-[17rem]")
    expect(within(panel).getByRole("switch", { name: "admin.exTopo.vpnDhcp" })).toBeInTheDocument()
    expect(within(panel).queryByRole("switch", { name: "admin.exTopo.vpn" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "admin.exTopo.closeSettings" }))
    fireEvent.click(screen.getByRole("button", { name: "admin.exTopo.devices" }))
    fireEvent.click(screen.getByRole("button", { name: "admin.exTopo.vpn" }))
    expect(screen.getByRole("switch", { name: "admin.exTopo.vpnDhcp" })).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("connects two nodes only after confirmation and selects the edge on both screens", () => {
    render(<Harness />)
    addNode("container")
    addNode("switch")
    fireEvent.click(screen.getByRole("button", { name: "admin.exTopo.addConnection" }))
    fireEvent.click(within(diagram()).getByRole("button", { name: "host-1" }))
    fireEvent.click(within(diagram()).getByRole("button", { name: "sw-1" }))
    expect(topology().Connections).toHaveLength(0)
    fireEvent.click(screen.getByRole("button", { name: "admin.exTopo.canvasConnect" }))
    expect(topology().Connections).toHaveLength(1)
    expect(topology().Connections[0].Endpoints[1].Interface).toBe("GigabitEthernet0/1")
    fireEvent.click(diagram().querySelector('[data-edge="e0"]')!)
    fireEvent.click(screen.getByRole("button", { name: "admin.exTopo.connections" }))
    expect(screen.getByTestId("connection-row-0")).toHaveClass("bg-accent")
    fireEvent.click(screen.getByRole("button", { name: "admin.exTopo.diagram" }))
    expect(diagram().querySelector('[data-edge="e0"]')).toHaveClass("stroke-primary")
  })

  it("marks occupied nodes unavailable before choosing a connection pair", () => {
    render(<Harness />)
    addNode("vpn")
    addNode("container")
    addNode("container")
    addNode("switch")
    fireEvent.click(screen.getByRole("button", { name: "admin.exTopo.addConnection" }))
    fireEvent.click(within(diagram()).getByRole("button", { name: "admin.exTopo.vpn" }))
    fireEvent.click(within(diagram()).getByRole("button", { name: "host-1" }))
    fireEvent.click(screen.getByRole("button", { name: "admin.exTopo.canvasConnect" }))

    fireEvent.click(screen.getByRole("button", { name: "admin.exTopo.addConnection" }))
    const vpn = within(diagram()).getByRole("button", { name: "admin.exTopo.vpn" })
    expect(vpn).toHaveAttribute("aria-disabled", "true")
    expect(vpn).toHaveAttribute("aria-description", "admin.exTopo.noFreePort")
    fireEvent.click(vpn)
    fireEvent.click(within(diagram()).getByRole("button", { name: "host-2" }))
    expect(screen.queryByRole("dialog", { name: "admin.exTopo.canvasConnect" })).not.toBeInTheDocument()
    fireEvent.contextMenu(vpn)
    expect(screen.getByRole("menuitem", { name: "admin.exTopo.addConnection" })).toBeDisabled()
  })

  it("cascades linked VPN connections only after confirmed removal", async () => {
    render(<Harness />)
    addNode("vpn")
    addNode("container")
    fireEvent.click(screen.getByRole("button", { name: "admin.exTopo.addConnection" }))
    fireEvent.click(within(diagram()).getByRole("button", { name: "admin.exTopo.vpn" }))
    fireEvent.click(within(diagram()).getByRole("button", { name: "host-1" }))
    fireEvent.click(screen.getByRole("button", { name: "admin.exTopo.canvasConnect" }))
    expect(topology().Connections[0].Endpoints[0].Interface).toBe("eth0")
    fireEvent.click(screen.getByRole("button", { name: "admin.exTopo.devices" }))
    fireEvent.click(within(screen.getByRole("button", { name: "admin.exTopo.vpn" }).parentElement!).getByRole("button", { name: "admin.exTopo.removeDevice" }))
    expect(topology().Connections).toHaveLength(1)
    await act(async () => {
      fireEvent.click(within(screen.getByRole("dialog", { name: "admin.exTopo.removeDevice" })).getByRole("button", { name: "admin.exTopo.removeDevice" }))
    })
    expect(topology().VPN.Enabled).toBe(false)
    expect(topology().Connections).toHaveLength(0)
  })
})
