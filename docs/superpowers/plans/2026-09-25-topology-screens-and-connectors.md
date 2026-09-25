# Topology Screens and Connector Ports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the topology editor with a diagram-only workspace, separate list screens, image-only nodes, and one named `eth0` port on each VPN/Internet connector.

**Architecture:** Keep the existing variant topology form and API as the sole model; `VisualRender` holds positions and optional icons only. Diagram context actions use dialogs, while selecting an item on a list screen edits it inline on that screen. A compatibility transition accepts legacy empty gateway interfaces and emits `eth0` for new/saved links; the operator still resolves each virtual gateway to its physical OVS port independently of that logical name.

**Tech Stack:** Go 1.27, Kubernetes operator, Next.js 16, React 19, TypeScript, react-hook-form, Zod 4, Vitest.

**Spec:** `../specs/2026-09-25-topology-canvas-workspace-design.md`; port capacity remains governed by `../specs/2026-09-25-topology-fixed-forwarding-ports-design.md`.

**Continuation:** This plan supersedes Tasks 12–15 of `2026-09-25-topology-operator-parity.md`; Tasks 1–11 there remain historical implementation/evidence. The image-only node and gateway configuration dialog slice already has uncommitted code and green focused tests; keep it and extend it rather than redoing it.

## Global Constraints

- Work sequentially in the existing `laboratory/feature/lab-access-acl`, `AP Backend/feature/superadmin-infrastructure-read`, and `admin-frontend/feature/base-redesign` branches, as previously chosen. Preserve unrelated dirty files and stage task-owned hunks only.
- Device types remain `container`, `unmanaged-switch`, `hub`; forwarding ports remain `GigabitEthernet0/1`–`GigabitEthernet0/48`, with no bandwidth promise.
- VPN and Internet are singletons, each with exactly one logical port named `eth0`; legacy empty interface values remain readable.
- A plain canvas click selects. Right click or the accessible equivalent offers only `Конфігурація`; only canvas actions open modals. List screens edit inline.
- Every canvas node is a square white-backed rounded image with a label below and no surrounding card. Use original Cisco image bytes, with selection/focus drawn outside the image.
- No live device status, participant canvas, device copy, or server-side canvas model in this slice.

## File and responsibility map

- `laboratory/internal/controller/laboratory/lab_controller.go`, `lab_ports_test.go`: operator boundary for logical singleton gateway interfaces; actual OVS port resolution remains in `internal/nodeagent/connection_reconciler.go` unchanged.
- `AP Backend/internal/model/exercise/topology.go`, `topology_test.go`: domain acceptance of `eth0` and legacy empty singleton endpoints. `internal/delivery/infrastructure/labagent/translate.go`, `translate_test.go`: explicit interface passed into LabSpec.
- `admin-frontend/src/api/exercises/versions.ts`, `src/lib/exerciseSchemas.ts`, `exerciseSchemas.test.ts`: normalize legacy snapshots and save `eth0`; reject any other gateway port.
- `admin-frontend/src/components/exercises/ConnectionList.tsx`, its test, and new `TopologyConnectionDialog.tsx`: named gateway port and shared connection choices, with a canvas-only dialog.
- `admin-frontend/src/components/exercises/TopologySection.tsx`, its test: three full workspace screens, singleton creation/removal, inline list editors and canvas-only configuration dialogs.
- `admin-frontend/src/components/exercises/TopologyDiagram.tsx`, its test, `src/lib/topologyIcons.ts`, `public/topology-icons/`: image node geometry, connector icons, context menu and selected edge.
- `admin-frontend/messages/{uk,en}.json`: only task-owned locale keys and copy; notification edits in those files belong to other work.

## Review Focus

1. A saved old endpoint with no gateway `Interface` opens, shows `eth0`, and saves without losing its link (Tasks 1–3).
2. A gateway's `eth0` cannot be selected for two connections, and disabling/deleting that gateway cannot leave an orphan link (Tasks 3–4).
3. A device opened from the list never creates a dialog, whereas the same device opened from the canvas does (Task 4).
4. Long names, densely connected nodes and a narrow viewport keep each label under its own image without a surrounding card or outer-page overflow (Task 5).
5. Two diagrams on the page have independent SVG clip-path IDs, so rounded images do not vanish or borrow another diagram's geometry (Task 5).

---

### Task 1: Validate singleton logical ports at the operator boundary

**Files:** Modify `laboratory/internal/controller/laboratory/lab_controller.go`; test `laboratory/internal/controller/laboratory/lab_ports_test.go`.

**Interfaces:** `validateGraph(*Lab)` accepts `vpn`/`internet` endpoint interface `eth0` or legacy `""`, rejects every other string. `resolveLocalPortKey` remains unchanged because the actual VPN/LabGateway port is keyed by the CRD network index, not the logical name.

- [ ] **Step 1: Add table tests** with `Interface` values `""`, `"eth0"`, `"eth1"`, and `"GigabitEthernet0/1"` on each gateway endpoint; assert first two pass and last two fail with `InvalidGatewayPort` before connection materialization. Keep a declared container `eth0` at the opposite endpoint.
- [ ] **Step 2: Run** `go test ./internal/controller/laboratory -run 'TestGatewayPort' -count=1`; expect the invalid values to pass incorrectly (red).
- [ ] **Step 3: In `validateGraph`, replace the gateway `continue` with the exact guard below.** Keep existing singleton/link limits elsewhere.

```go
if ep.Interface != "" && ep.Interface != "eth0" {
    return fmt.Errorf("InvalidGatewayPort: %s has no port %q", ep.Device, ep.Interface)
}
continue
```
- [ ] **Step 4: Run** the focused test, `go test ./internal/controller/laboratory ./api/laboratory/v1alpha1 -count=1`, and `git diff --check`; then commit only the two task files as `feat(lab): validate singleton gateway port`.

### Task 2: Roundtrip `eth0` through the exercise backend

**Files:** Modify `AP Backend/internal/model/exercise/topology.go`, `topology_test.go`, `internal/delivery/infrastructure/labagent/translate.go`, `translate_test.go`.

**Interfaces:** `Topology.validateStructure` accepts `Endpoint{Kind: vpn|internet, DeviceID: nil, Interface: "eth0"}` and legacy `""`, rejects other interfaces; `buildEndpoint` sets `labEndpoint.Interface` to `"eth0"` for both kinds, including old saved empty values.

- [ ] **Step 1: Add domain tests** for VPN and Internet endpoints with `eth0`, `""`, and `eth1`; require valid structure for the first two and `ErrConnectionEndpointsInvalid` for `eth1`. Add translator tests showing both modern and legacy gateway endpoints serialize to `{ "device": "vpn", "interface": "eth0" }` or Internet equivalent.
- [ ] **Step 2: Run** `go test ./internal/model/exercise ./internal/delivery/infrastructure/labagent -run 'Test.*(Gateway|Connections)' -count=1`; expect the modern validation/translation assertions to fail.
- [ ] **Step 3: Change the non-device endpoint predicate and gateway translator arms as shown.** Do not derive the actual OVS port from this logical value.

```go
(ep.Kind != EndpointDevice && (ep.DeviceID != uuid.Nil || (ep.Interface != "" && ep.Interface != "eth0")))
// buildEndpoint gateway arms:
case exerciseModel.EndpointVPN:
    return labEndpoint{Device: reservedDeviceVPN, Interface: "eth0"}
case exerciseModel.EndpointInternet:
    return labEndpoint{Device: reservedDeviceInternet, Interface: "eth0"}
```
- [ ] **Step 4: Run** the two package suites, `go run ./tools/checkerrorcodes internal pkg`, `go run ./tools/checklayers internal/model`, and `git diff --check`. Commit task-owned files as `feat(exercise): preserve gateway eth0 in lab specs`.

### Task 3: Normalize and select the single connector port in the frontend

**Files:** Modify `admin-frontend/src/api/exercises/versions.ts`, `src/lib/exerciseSchemas.ts`, `exerciseSchemas.test.ts`, `src/components/exercises/ConnectionList.tsx`, `ConnectionList.test.tsx`; extract `TopologyConnectionDialog.tsx` from the existing `pendingPair` dialog so the list screen does not mount a hidden list just to show a canvas dialog.

**Interfaces:** `normalizeTopology` maps a legacy VPN/Internet endpoint with missing `Interface` to `"eth0"`; `topologyToDTO` writes `{ Kind: "vpn"|"internet", Interface: "eth0" }`; `encodeEndpoint` remains `"vpn"|"internet"`, while `decodeEndpoint` returns `Interface: "eth0"`. Gateway option labels show `· eth0`; occupied singleton options disappear except for the row being edited.

- [ ] **Step 1: Add tests** for legacy DTO normalization, explicit serialization, invalid `eth1`, one-port option labels, occupancy, and keeping a row's own gateway when editing. Add a canvas dialog test confirming an `eth0` endpoint is inserted only on confirmation.
- [ ] **Step 2: Run** `npx vitest run src/lib/exerciseSchemas.test.ts src/components/exercises/ConnectionList.test.tsx src/components/exercises/TopologyConnectionDialog.test.tsx`; expect red assertions.
- [ ] **Step 3: Introduce one `GATEWAY_PORT` constant** in `src/lib/topologyPorts.ts` and use it in normalization, serialization, Zod endpoint validation and connection choices. Keep `DeviceID: ""` on singleton endpoints. Extract current `CanvasConnectionChoice` and its dialog into `TopologyConnectionDialog`, with its `append` callback supplied by `TopologySection`; list rows remain inline. Core mapping:

```ts
export const GATEWAY_PORT = "eth0" as const
// normalizeTopology endpoint:
Interface: ep.Kind === "device" ? ep.Interface ?? "" : ep.Interface || GATEWAY_PORT,
// topologyToDTO endpoint when Kind !== "device":
{ Kind: ep.Kind, Interface: GATEWAY_PORT }
// decodeEndpoint("vpn" | "internet"):
{ Kind: value, DeviceID: "", Interface: GATEWAY_PORT }
```
- [ ] **Step 4: Run** the focused tests, `npx tsc --noEmit`, ESLint for changed exercise files and `git diff --check`. If typecheck still fails in the unrelated dirty `hover-tooltip.test.tsx`, report that failure without modifying that file. Commit only owned code and task-owned locale hunks as `feat(exercises): use eth0 for topology connectors`.

### Task 4: Separate canvas and list screens; make gateways canvas nodes

**Files:** Modify `admin-frontend/src/components/exercises/TopologySection.tsx`, `TopologySection.test.tsx`, `NetworkToggles.tsx`, `TopologyDiagram.tsx`, `TopologyDiagram.test.tsx`, `messages/{uk,en}.json` narrowly.

**Interfaces:** `TopologySection` owns `view: "diagram"|"devices"|"connections"` plus `selectedKey` and `selectedConnectionIndex`; changing view does not mutate the form. `TopologyDiagram` adds `onEdgeSelect?: (index: number) => void` and `selectedConnectionIndex?: number` so a selected line can correspond to a list row. The diagram toolbar's type picker offers container, switch, hub, VPN and Internet, disabling an already enabled singleton. `addGateway(kind)` sets `${base}.${kind}.Enabled = true` and stores a `VisualRender` position. Canvas `onNodeSettings("vpn"|"internet")` opens only that connector's DHCP configuration; list selection renders `NetworkToggles` or `DeviceCard` inline. In both configuration paths, hide the connector's Enabled switch and show only DHCP; removing/disabling the node is a separate confirmed action. Removing a linked connector or device clears affected connections only on confirmation.

- [ ] **Step 1: Add UI tests** for all three screens; list selection with no dialog; diagram context-menu configuration with a dialog (also Shift+F10 and a visible selected-node action for touch); immediate singleton creation and an empty-canvas add action; one-port occupancy; connected-gateway removal confirmation/cascade; selecting a connection line and its list row; and returning to the canvas with selection intact.
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

**Files:** Modify `admin-frontend/src/components/exercises/TopologyDiagram.tsx`, `TopologyDiagram.test.tsx`, `src/lib/topologyIcons.ts`, `public/topology-icons/SOURCE.md` and task-owned image files. Make only failure-driven edits elsewhere.

**Interfaces:** Each node renders one `72×72` white square `rect` with `rx=10`, one unaltered Cisco JPEG clipped to that shape, a separate transparent selection/hover ring on the same square, and a centered text label below; no card surrounds both. VPN uses `vpn gateway.jpg`, Internet uses `cloud.jpg`. The edge line ends on the image square and shows the logical gateway `eth0` near its endpoint. SVG clip IDs include a per-diagram `useId()` prefix.

- [ ] **Step 1: Extend diagram tests** to cover all five node kinds, vertical label placement, absence of a larger card, two simultaneous diagram instances, hover/focus ring class, and gateway edge `eth0` labels. Use a topology with one enabled VPN and one enabled Internet.
- [ ] **Step 2: Run** `npx vitest run src/components/exercises/TopologyDiagram.test.tsx`; expect at least the gateway edge label/two-instance assertions to fail. Preserve already-green image geometry tests added during the approved visual slice.
- [ ] **Step 3: Complete node and edge rendering** using the existing rounded image frame, Cisco assets and `GATEWAY_PORT`; change the context-menu copy to `Конфігурація`/`Configuration`. Do not add a card fill around the label. Check asset checksums against `3015_jpeg.zip` and keep attribution in `SOURCE.md`. Keep the existing direct node structure:

```tsx
<rect data-icon-frame width={72} height={72} rx={10} fill="white" />
<image href={icon} width={72} height={72} clipPath={`url(#${clipId})`} />
<rect width={72} height={72} rx={10} fill="none" className={selected ? "stroke-primary" : "stroke-transparent group-hover:stroke-primary/60"} />
<text textAnchor="middle" y={imageBottom + 20}>{node.label}</text>
```
- [ ] **Step 4: Run** focused frontend tests, frontend build/typecheck/lint, backend/operator scoped and full tests where practical, CRD manifest comparison, `git diff --check`; visually inspect desktop and narrow canvas once, fix high-impact findings, and inspect once more. Run the design detector once on changed UI files. Report any unrelated pre-existing failures distinctly.
- [ ] **Step 5: Review `git status` in all three repos, stage only task-owned files and locale hunks, commit the visual/acceptance slice as `feat(exercises): finish topology canvas visuals`. Do not stage notification or flag edits. Report that logical 48-port capacity does not guarantee bandwidth and live runtime status is not yet in the editor.
