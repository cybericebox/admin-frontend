# Topology Screens and Connector Ports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the topology editor with a canvas-first workspace, separate list screens, original flat vector device pictograms, compact right-side configuration, and one named `eth0` port on each VPN/Internet connector.

**Architecture:** Keep the existing variant topology form and API as the sole model; `VisualRender` holds positions, label offsets and optional icons only. Diagram context configuration uses a compact right inspector; selecting an item on a list screen edits it inline on that screen. A dialog is used for connection creation and destructive confirmation. Gateway endpoints require `eth0` at every layer; the operator still resolves each virtual gateway to its physical OVS port independently of that logical name. The API is new and has no old links to migrate.

**Tech Stack:** Go 1.27, Kubernetes operator, Next.js 16, React 19, TypeScript, react-hook-form, Zod 4, Vitest.

**Spec:** `../specs/2026-09-25-topology-canvas-workspace-design.md`; port capacity remains governed by `../specs/2026-09-25-topology-fixed-forwarding-ports-design.md`.

**Continuation:** This plan supersedes Tasks 12–15 of `2026-09-25-topology-operator-parity.md`; Tasks 1–11 there remain historical implementation/evidence. The image-only node and gateway configuration dialog slice already has uncommitted code and green focused tests; keep it and extend it rather than redoing it.

**Latest user ruling (supersedes older Task 4/5 prose below):** Replace canvas-origin configuration dialogs with a narrow, nonblocking right inspector that shrinks the canvas at wide widths and overlays it at narrow widths. Replace Cisco JPEG tiles with original flat vector pictograms; no white frame. The older dialog/image instructions in Task 4 and historical examples are not to be reintroduced. Device settings in that inspector use one-column fields, a separate Resources tab, compact per-variable and per-route cards (fields stack in the narrow inspector), and a single horizontally scrolling interface strip with collision-free `ethN` creation. The connection dialog remains compact and its 48-port dropdown alone scrolls. Dense topology links reveal port labels on selection/hover/focus; the internally scrollable board grows enough to keep automatically placed nodes distinct.

**Final review adjustment:** On desktop, the inspector may shrink to 17rem to retain an approximately 4:1 canvas-to-inspector split. Nodes without a free port are disabled with an explanation during connection selection, and link accessibility labels/tooltips use device names rather than internal IDs. Compact route cards retain a reserved error slot as explicitly requested by the user.

## Global Constraints

- Work sequentially in the existing `laboratory/feature/lab-access-acl`, `AP Backend/feature/superadmin-infrastructure-read`, and `admin-frontend/feature/base-redesign` branches, as previously chosen. Preserve unrelated dirty files and stage task-owned hunks only.
- Device types remain `container`, `unmanaged-switch`, `hub`; forwarding ports remain `GigabitEthernet0/1`–`GigabitEthernet0/48`, with no bandwidth promise.
- VPN and Internet are singletons, each with exactly one logical port named `eth0`; empty interface values are invalid.
- A plain node click selects. Right click on a node offers `Конфігурація`, `Додати зʼєднання`, and removal; right click on empty canvas offers node creation and connection mode. Canvas configuration opens a right inspector; list screens edit inline.
- Every canvas node is an original flat vector pictogram drawn directly on the board, with a movable label below and no white tile/card. Use Cisco references for semantics only: Cisco assets must not be recolored or modified.
- No live device status, participant canvas, device copy, or server-side canvas model in this slice.

## File and responsibility map

- `laboratory/internal/controller/laboratory/lab_controller.go`, `lab_ports_test.go`: operator boundary for logical singleton gateway interfaces; actual OVS port resolution remains in `internal/nodeagent/connection_reconciler.go` unchanged.
- `AP Backend/internal/model/exercise/topology.go`, `topology_test.go`: domain acceptance of only `eth0` on singleton endpoints. `internal/delivery/infrastructure/labagent/translate.go`, `translate_test.go`: explicit interface passed into LabSpec.
- `admin-frontend/src/api/exercises/versions.ts`, `src/lib/exerciseSchemas.ts`, `exerciseSchemas.test.ts`: retain and save `eth0`; reject missing or other gateway ports.
- `admin-frontend/src/components/exercises/ConnectionList.tsx`, its test, and new `TopologyConnectionDialog.tsx`: named gateway port and shared connection choices, with a canvas-only dialog.
- `admin-frontend/src/components/exercises/TopologySection.tsx`, its test: three full workspace screens, singleton creation/removal, inline list editors and canvas-only configuration dialogs.
- `admin-frontend/src/components/exercises/TopologyDiagram.tsx`, `TopologyGlyph.tsx`, their tests, `src/lib/topologyIcons.ts`: vector node geometry, connector icons, context menu and selected edge.
- `admin-frontend/messages/{uk,en}.json`: only task-owned locale keys and copy; notification edits in those files belong to other work.

## Review Focus

1. A gateway endpoint without `Interface` is rejected; a valid `eth0` endpoint roundtrips unchanged (Tasks 1–3).
2. A gateway's `eth0` cannot be selected for two connections, and disabling/deleting that gateway cannot leave an orphan link (Tasks 3–4).
3. A device opened from the list edits inline; from the canvas it opens the right inspector without obscuring the diagram (Task 4).
4. Long names, densely connected nodes and a narrow viewport retain movable labels and no outer-page overflow; fullscreen retains fixed visual icon size (Task 5).
5. Flat L2 switch, L3 switch, hub, router, server and firewall glyphs are recognizably distinct and use no copied Cisco images (Task 5).
6. A user can start at one node, click a second node, choose both free ports and confirm a new visible link. Pointer jitter under 5 px must not turn a click into a drag.

---

### Task 1: Validate singleton logical ports at the operator boundary

**Files:** Modify `laboratory/internal/controller/laboratory/lab_controller.go`; test `laboratory/internal/controller/laboratory/lab_ports_test.go`.

**Interfaces:** `validateGraph(*Lab)` accepts only `eth0` on `vpn`/`internet` endpoints. `resolveLocalPortKey` remains unchanged because the actual VPN/LabGateway port is keyed by the CRD network index, not the logical name.

- [ ] **Step 1: Add table tests** with `Interface` values `""`, `"eth0"`, `"eth1"`, and `"GigabitEthernet0/1"` on each gateway endpoint; assert only `eth0` passes and all others fail with `InvalidGatewayPort` before connection materialization. Keep a declared container `eth0` at the opposite endpoint.
- [ ] **Step 2: Run** `go test ./internal/controller/laboratory -run 'TestGatewayPort' -count=1`; expect the invalid values to pass incorrectly (red).
- [ ] **Step 3: In `validateGraph`, replace the gateway `continue` with the exact guard below.** Keep existing singleton/link limits elsewhere.

```go
if ep.Interface != "eth0" {
    return fmt.Errorf("InvalidGatewayPort: %s has no port %q", ep.Device, ep.Interface)
}
continue
```
- [ ] **Step 4: Run** the focused test, `go test ./internal/controller/laboratory ./api/laboratory/v1alpha1 -count=1`, and `git diff --check`; then commit only the two task files as `feat(lab): validate singleton gateway port`.

### Task 2: Roundtrip `eth0` through the exercise backend

**Files:** Modify `AP Backend/internal/model/exercise/topology.go`, `topology_test.go`, `internal/delivery/infrastructure/labagent/translate.go`, `translate_test.go`.

**Interfaces:** `Topology.validateStructure` accepts only `Endpoint{Kind: vpn|internet, DeviceID: nil, Interface: "eth0"}`; `buildEndpoint` passes the validated interface into LabSpec unchanged.

- [ ] **Step 1: Add domain tests** for VPN and Internet endpoints with `eth0`, `""`, and `eth1`; require valid structure only for `eth0` and `ErrConnectionEndpointsInvalid` otherwise. Add translator tests showing a valid gateway endpoint serializes to `{ "device": "vpn", "interface": "eth0" }` or Internet equivalent.
- [ ] **Step 2: Run** `go test ./internal/model/exercise ./internal/delivery/infrastructure/labagent -run 'Test.*(Gateway|Connections)' -count=1`; expect the modern validation/translation assertions to fail.
- [ ] **Step 3: Change the non-device endpoint predicate and gateway translator arms as shown.** Do not derive the actual OVS port from this logical value.

```go
(ep.Kind != EndpointDevice && (ep.DeviceID != uuid.Nil || ep.Interface != "eth0"))
// buildEndpoint gateway arms:
case exerciseModel.EndpointVPN:
    return labEndpoint{Device: reservedDeviceVPN, Interface: ep.Interface}
case exerciseModel.EndpointInternet:
    return labEndpoint{Device: reservedDeviceInternet, Interface: ep.Interface}
```
- [ ] **Step 4: Run** the two package suites, `go run ./tools/checkerrorcodes internal pkg`, `go run ./tools/checklayers internal/model`, and `git diff --check`. Commit task-owned files as `feat(exercise): preserve gateway eth0 in lab specs`.

### Task 3: Normalize and select the single connector port in the frontend

**Files:** Modify `admin-frontend/src/api/exercises/versions.ts`, `src/lib/exerciseSchemas.ts`, `exerciseSchemas.test.ts`, `src/components/exercises/ConnectionList.tsx`, `ConnectionList.test.tsx`; extract `TopologyConnectionDialog.tsx` from the existing `pendingPair` dialog so the list screen does not mount a hidden list just to show a canvas dialog.

**Interfaces:** `normalizeTopology` retains an explicit VPN/Internet `Interface: "eth0"` without filling missing values; `topologyToDTO` writes `{ Kind: "vpn"|"internet", Interface: "eth0" }`; `encodeEndpoint` remains `"vpn"|"internet"`, while `decodeEndpoint` returns `Interface: "eth0"`. Gateway option labels show `· eth0`; occupied singleton options disappear except for the row being edited.

- [ ] **Step 1: Add tests** for explicit `eth0` normalization and serialization, invalid empty/`eth1`, one-port option labels, occupancy, and keeping a row's own gateway when editing. Add a canvas dialog test confirming an `eth0` endpoint is inserted only on confirmation.
- [ ] **Step 2: Run** `npx vitest run src/lib/exerciseSchemas.test.ts src/components/exercises/ConnectionList.test.tsx src/components/exercises/TopologyConnectionDialog.test.tsx`; expect red assertions.
- [ ] **Step 3: Introduce one `GATEWAY_PORT` constant** in `src/lib/topologyPorts.ts` and use it in normalization, serialization, Zod endpoint validation and connection choices. Keep `DeviceID: ""` on singleton endpoints. Extract current `CanvasConnectionChoice` and its dialog into `TopologyConnectionDialog`, with its `append` callback supplied by `TopologySection`; list rows remain inline. Core mapping:

```ts
export const GATEWAY_PORT = "eth0" as const
// normalizeTopology endpoint: preserve the explicit contract; do not invent an omitted gateway interface.
Interface: ep.Interface ?? "",
// topologyToDTO endpoint when Kind !== "device":
{ Kind: ep.Kind, Interface: GATEWAY_PORT }
// decodeEndpoint("vpn" | "internet"):
{ Kind: value, DeviceID: "", Interface: GATEWAY_PORT }
```
- [ ] **Step 4: Run** the focused tests, `npx tsc --noEmit`, ESLint for changed exercise files and `git diff --check`. If typecheck still fails in the unrelated dirty `hover-tooltip.test.tsx`, report that failure without modifying that file. Commit only owned code and task-owned locale hunks as `feat(exercises): use eth0 for topology connectors`.

### Task 4: Separate canvas and list screens; make gateways canvas nodes

**Files:** Modify `admin-frontend/src/components/exercises/TopologySection.tsx`, `TopologySection.test.tsx`, `NetworkToggles.tsx`, `TopologyDiagram.tsx`, `TopologyDiagram.test.tsx`, `messages/{uk,en}.json` narrowly.

**Interfaces:** `TopologySection` owns `view: "diagram"|"devices"|"connections"` plus `selectedKey` and `selectedConnectionIndex`; changing view does not mutate the form. `TopologyDiagram` adds `onEdgeSelect?: (index: number) => void` and `selectedConnectionIndex?: number` so a selected line can correspond to a list row. The diagram toolbar's type picker offers container, switch, hub, VPN and Internet, disabling an already enabled singleton. `addGateway(kind)` sets `${base}.${kind}.Enabled = true` and stores a `VisualRender` position. Canvas `onNodeSettings("vpn"|"internet")` opens only that connector's DHCP configuration; list selection renders `NetworkToggles` or `DeviceCard` inline. In both configuration paths, hide the connector's Enabled switch and show only DHCP; removing/disabling the node is a separate confirmed action. Removing a linked connector or device clears affected connections only on confirmation.

- [ ] **Step 1: Add UI tests** for all three screens; list selection with no dialog; diagram context-menu configuration with a dialog (also Shift+F10); immediate singleton creation and an empty-canvas add action; creating a link by right-clicking the source node and clicking the target, including two containers; one-port occupancy; connected-gateway removal confirmation/cascade; selecting a connection line and its list row; and returning to the canvas with selection intact.
- [ ] **Step 2: Run** `npx vitest run src/components/exercises/TopologySection.test.tsx`; expect navigation, gateway creation and list-editor assertions to fail.
- [ ] **Step 3: Replace the current two-column `TopologySection` layout** with a compact three-view navigation and one `min-h-0` work area. Keep diagram actions within the diagram view; render `ConnectionList` only on the connections screen and `TopologyConnectionDialog` only for a canvas-origin pending pair. Render device and gateway detail forms inline on the devices screen. Keep selection state in `TopologySection`, not `VisualRender`.

```tsx
const [view, setView] = useState<"diagram" | "devices" | "connections">("diagram")
// Each button sets view; render exactly one work surface:
{view === "diagram" ? <TopologyDiagram topology={topology} onNodeSelect={selectNode} onNodeSettings={openSettings} />
  : view === "devices" ? <div className="grid min-h-0 grid-cols-[14rem_minmax(0,1fr)] gap-3">
      <div>{devices.map((device) => <button key={device.ID} type="button" onClick={() => setSelectedKey(device.ID)}>{device.Name}</button>)}
        {topology.VPN.Enabled && <button type="button" onClick={() => setSelectedKey("vpn")}>VPN</button>}
        {topology.Internet.Enabled && <button type="button" onClick={() => setSelectedKey("internet")}>Internet</button>}
      </div>
      {devices.findIndex((device) => device.ID === selectedKey) >= 0
        ? <DeviceCard variantIndex={variantIndex} deviceIndex={devices.findIndex((device) => device.ID === selectedKey)} disabled={disabled} />
        : selectedKey === "vpn" || selectedKey === "internet" ? <NetworkToggles variantIndex={variantIndex} disabled={disabled} network={selectedKey === "vpn" ? "VPN" : "Internet"} showEnabled={false} /> : null}
    </div>
  : <ConnectionList variantIndex={variantIndex} disabled={disabled} />}
```

- [ ] **Step 4: Add singleton create/remove callbacks** that update only the chosen `VPN` or `Internet` branch, and clear connections whose endpoint `Kind` matches that branch only after confirmation. Do not create a second `NetworkDTO` object or a new backend API.

```ts
function addGateway(kind: "vpn" | "internet") {
  const branch = kind === "vpn" ? "VPN" : "Internet"
  setValue(`${base}.${branch}.Enabled`, true, { shouldDirty: true })
  moveNode(kind, { x: kind === "vpn" ? 0.34 : 0.66, y: 0.18 })
  setSelectedKey(kind)
}
// In the confirmed removal handler:
setValue(`${base}.Connections`, getValues(`${base}.Connections`).filter((link) =>
  !link.Endpoints.some((endpoint) => endpoint.Kind === kind)), { shouldDirty: true })
setValue(`${base}.${branch}.Enabled`, false, { shouldDirty: true })
```
- [ ] **Step 5: Run** the focused component tests, typecheck, ESLint and `git diff --check`; commit owned files and locale hunks as `feat(exercises): separate topology diagram and list screens`.

### Task 5: Finish icon geometry, selection, and whole-path verification

**Files:** Modify `admin-frontend/src/components/exercises/TopologyDiagram.tsx`, `TopologyDiagram.test.tsx`, `TopologyGlyph.tsx`, `TopologyGlyph.test.tsx`, `src/lib/topologyIcons.ts`; remove task-created unused Cisco image files. Make only failure-driven edits elsewhere.

**Interfaces:** Each node renders an original flat SVG glyph directly on the canvas with a wide transparent hitbox and a separate thin outline tightly following the glyph; no tile or card. L2 switch, L3 switch, hub, router, server, firewall, VPN and Internet are visually distinct. The edge line touches the visible glyph, has no detached circle markers, and shows logical gateway `eth0` near its endpoint. Stored visual positions and label offsets are normalized; icon screen size stays fixed when the canvas resizes or enters fullscreen.

- [ ] **Step 1: Extend diagram/glyph tests** to cover all pictogram kinds, vertical label placement, absence of white tiles, hover/focus ring, draggable labels, responsive viewport sizing and gateway edge `eth0` labels.
- [ ] **Step 2: Run** `npx vitest run src/components/exercises/TopologyDiagram.test.tsx src/components/exercises/TopologyGlyph.test.tsx`; verify RED for each new behavior before implementation.
- [ ] **Step 3: Complete node and edge rendering** using original SVG glyphs and `GATEWAY_PORT`; keep the context-menu copy `Конфігурація`/`Configuration`. Remove obsolete task-created JPEG assets and their attribution. Keep the transparent hitbox only for interaction; draw a separate outline close to each glyph and anchor lines to its actual shape:

```tsx
<TopologyGlyph kind={icon} width={38} height={38} />
<rect data-icon-hitbox width={56} height={56} fill="transparent" />
<rect data-selection-outline width={glyphWidth + 4} height={glyphHeight + 4} fill="none" className={selected ? "stroke-primary" : "stroke-transparent group-hover:stroke-primary/60"} />
<text textAnchor="middle" y={iconBottom + 17}>{node.label}</text>
```
- [ ] **Step 4: Run** focused frontend tests, frontend build/typecheck/lint, backend/operator scoped and full tests where practical, CRD manifest comparison, `git diff --check`; visually inspect desktop and narrow canvas once, fix high-impact findings, and inspect once more. Run the design detector once on changed UI files. Report any unrelated pre-existing failures distinctly.
- [ ] **Step 5: Review `git status` in all three repos, stage only task-owned files and locale hunks, commit the visual/acceptance slice as `feat(exercises): finish topology canvas visuals`. Do not stage notification or flag edits. Report that logical 48-port capacity does not guarantee bandwidth and live runtime status is not yet in the editor.
