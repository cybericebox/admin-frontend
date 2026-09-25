# Topology Operator Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the admin a canvas-first topology workspace that faithfully saves and deploys supported container/network settings and enforces 48 logical ports per switch/hub.

**Architecture:** Tasks 1–7 established operator parity for devices, resources and routes. The continuation first validates fixed switch/hub endpoint names in the operator, then mirrors the contract in the backend and frontend, and finally makes the canvas the primary editor with auxiliary lists. The form remains the single topology model; `VisualRender` stores only positions/icon choices. Keep the existing API route, JSONB snapshots and forwarding behavior.

**Tech Stack:** Go 1.27, Kubernetes Quantity/netip, kubebuilder/controller-gen, React 19, Next.js 16, TypeScript, Zod 4, react-hook-form, Vitest, Tailwind.

**Spec:** `../specs/2026-09-25-topology-operator-parity-design.md`, `../specs/2026-09-25-topology-fixed-forwarding-ports-design.md`, `../specs/2026-09-25-topology-canvas-workspace-design.md`

**Continuation status (2026-09-25):** Tasks 1–7 have scoped implementation commits (`laboratory b5e0361`; `AP Backend 173f226`, `5ad88a1`; `admin-frontend 08b0c8e`, `1ba1d94`, `2772b08`, `0d133d6`). Their original checkboxes are historical instructions, not a new work queue. Task 8 remains the earlier acceptance audit; Tasks 9–15 below are the newly approved sequential work. Execute natively in this task, without subagents, as the user requested.

The canvas-first layout in Tasks 12–14 supersedes Task 6's separate Diagram tab. Do not undo its completed resource, route, or grouped-list work while replacing that navigation.

## Global Constraints

- Work in the existing `admin-frontend/feature/base-redesign`, `AP Backend/feature/superadmin-infrastructure-read`, and `laboratory/feature/lab-access-acl` branches; do not stage unrelated dirty files.
- Supported device values are exactly `container`, `unmanaged-switch`, `hub`; the user confirmed no saved VM devices.
- Keep `Addresses []string` in the API/JSONB snapshot, but require exactly one CIDR for `static` and zero for other modes; multiple static IPs are out of scope.
- Resource fields are optional Kubernetes Quantity strings; each present value must be positive, and a paired request must not exceed its limit.
- Routes exist only for static IP; each has required `Dst` CIDR and `Via` IP of the same family.
- Keep VPN/Internet, DHCP, connections, canvas coordinates, secrets, external exposure, and test deployment behavior unchanged. Do not add test-list UI or API.
- User addendum: task owns `LinkedDeviceID`/`DeviceFlagVar`; device env shows a derived read-only task-flag binding. Reject a name collision with ordinary env vars or a second task target, and use Ukrainian «прапор» in the transfer copy.
- Switch/hub have exactly `GigabitEthernet0/1`–`GigabitEthernet0/48` as logical endpoint names; a port is occupied by at most one connection. No physical OVS interfaces or bandwidth/QoS guarantee are added.
- Canvas is the primary topology view. Ordinary click selects; context menu initially contains only Settings. Device creation appends immediately without opening settings; connection creation is an explicit mode followed by a two-endpoint port dialog. Device duplication, runtime status, participant view, and task attachment remain out of scope.
- Match existing restrained palette, typography, accessible labels and focus behavior; verify wide, intermediate, and narrow screens visually.

## File/ownership map

| Repository | Files | Responsibility |
| --- | --- | --- |
| laboratory | `api/laboratory/v1alpha1/shared_types.go`, generated CRDs in `config/crd/bases/` and `charts/laboratory/crds/`, operator tests/comments including `internal/nodeagent/device_reconciler.go` | Public device enum and CRD parity; existing resource/route execution stays intact |
| AP Backend | `internal/model/exercise/topology.go`, `errors.go`, `topology_test.go` | Snapshot types and authoritative shape validation |
| AP Backend | `internal/delivery/controller/http/handler/exercise/dto.go` and tests; `internal/delivery/infrastructure/labagent/translate.go` and tests | API roundtrip and LabSpec JSON mapping |
| admin-frontend | `src/api/exercises/versions.ts`, `src/lib/exerciseSchemas.ts` and tests | Optional DTO fields, normalized form values, serialization and validation |
| admin-frontend | `src/components/exercises/{DeviceCard,InterfaceForm,TopologySection,NetworkToggles,TaskForm,FlagInput}.tsx`, related tests including `TaskAccordion.test.tsx`, `src/app/globals.css`, `messages/{uk,en}.json` | Editor fields/layout and container-only copy |
| laboratory | `api/laboratory/v1alpha1/shared_types.go`, `internal/controller/laboratory/{lab_controller.go,lab_ports_test.go}` | Fixed logical port vocabulary, graph validation, Kubernetes-safe connection names |
| AP Backend | `internal/model/exercise/{topology.go,version.go,errors.go,topology_test.go}`, `internal/useCase/exercise/{deploy.go,deploy_test.go}`, translator tests | Mirror occupied-port validation; reject invalid test deploys before infrastructure calls |
| admin-frontend | `src/lib/topologyPorts.ts` and tests, `src/lib/exerciseSchemas.ts` and tests, `src/components/exercises/{ConnectionList,TopologySection,TopologyDiagram,TopologyConnectionDialog,TopologyDeviceDialog}.tsx` and tests, `src/components/ui/context-menu.tsx`, `public/topology-icons/`, locale keys | Free-port selection, primary canvas, context menu, dialogs, unchanged icons and synchronized lists |

## Review Focus

1. An old snapshot omitting resources/routes must open, save, and read back without adding invalid empty API objects (Tasks 2, 4).
2. A non-static IP switched from static must not retain its old address, gateway, or routes in form state or API payload (Tasks 2, 4, 5).
3. A route such as IPv6 `2001:db8:1::/64` via `2001:db8::1` must pass, while a mixed-family pair must fail (Tasks 2, 4).
4. A forwarding device with resource values must be rejected by API even if a forged client sends them (Task 2).
5. Selecting another device must keep the available horizontal subtab; selecting a switch while on a container-only subtab must show Basic with usable focus (Task 6).
6. A flag target name colliding with a regular device env var or another task must be rejected before save, while bindings to different devices remain independent (Tasks 2, 4, 7).
7. `GigabitEthernet0/1` must survive endpoint JSON and status unchanged, while the materialized Kubernetes `Connection.metadata.name` stays lowercase DNS-safe and distinct from a literal `GigabitEthernet0-1` (Task 9).
8. A switch connected 48 times must reject a 49th link, a duplicate port and a missing port in direct `Lab.spec`; two switches may each use `GigabitEthernet0/1` (Task 9).
9. A saved but unpublished variant with an invalid switch port must be rejected by test deployment before allocating a lab, not only by publish validation (Task 10).
10. An existing row's own port remains selectable when editing; after deleting its connection it returns to the available list (Task 11).
11. A right-click Settings action, plain-click selection, Escape from link mode, and a removed device with linked connections must not leave phantom canvas state or accidentally create a link (Tasks 12–14).

---

### Task 1: Remove the unsupported VM type from the operator

**Files:** Modify `laboratory/api/laboratory/v1alpha1/shared_types.go`, `laboratory/internal/controller/laboratory/lab_controller.go`, `laboratory/internal/nodeagent/device_reconciler.go` only where comments or VM branches remain; generated `laboratory/config/crd/bases/laboratory.cybericebox.com_{devices,labs}.yaml` and `laboratory/charts/laboratory/crds/laboratory.cybericebox.com_{devices,labs}.yaml`; test `laboratory/api/laboratory/v1alpha1/device_type_test.go` and `laboratory/internal/controller/laboratory/device_routes_test.go`.

**Interfaces:** Produces the public `DeviceType` enum `container|unmanaged-switch|hub`; existing `DeviceResources` and `Route` definitions remain unchanged.

- [ ] **Step 1: Write a failing enum/manifest test.** Add `device_type_test.go`:

```go
package v1alpha1

import (
  "os"
  "strings"
  "testing"
)

func TestDeviceTypeEnumHasNoVM(t *testing.T) {
  if DeviceType("vm") == DeviceTypeContainer || DeviceType("vm") == DeviceTypeUnmanagedSwitch || DeviceType("vm") == DeviceTypeHub { t.Fatal("vm matched a supported type") }
  for _, path := range []string{"../../../config/crd/bases/laboratory.cybericebox.com_devices.yaml", "../../../config/crd/bases/laboratory.cybericebox.com_labs.yaml", "../../../charts/laboratory/crds/laboratory.cybericebox.com_devices.yaml", "../../../charts/laboratory/crds/laboratory.cybericebox.com_labs.yaml"} {
    b, err := os.ReadFile(path); if err != nil { t.Fatal(err) }
    if strings.Contains(string(b), "- vm") { t.Errorf("%s still admits vm", path) }
  }
}
```

- [ ] **Step 2: Run `go test ./api/laboratory/v1alpha1 -run TestDeviceTypeEnumHasNoVM -count=1`; expect failure because four CRDs still contain `- vm`.**
- [ ] **Step 3: Remove `DeviceTypeVM` and `vm` from the kubebuilder enum. Run `make manifests`; copy only the two generated device/lab CRDs from `config/crd/bases/` into `charts/laboratory/crds/`. Replace stale `container/vm` comments; do not modify resource/route code.** The source declaration becomes:

```go
// +kubebuilder:validation:Enum=container;unmanaged-switch;hub
type DeviceType string

const (
  DeviceTypeContainer DeviceType = "container"
  DeviceTypeUnmanagedSwitch DeviceType = "unmanaged-switch"
  DeviceTypeHub DeviceType = "hub"
)
```
- [ ] **Step 4: Run `go test ./api/laboratory/v1alpha1 ./internal/controller/laboratory -count=1`, `make manifests`, and `git diff --check`; expect pass and no generated drift.**
- [ ] **Step 5: Add an operator regression test and run `go test ./internal/controller/laboratory -run 'TestDeviceResources|TestNetConfigStaticRoute' -count=1`; expect pass.** The test body:

```go
func TestNetConfigStaticRoute(t *testing.T) {
  d := &laboratoryv1alpha1.Device{}
  d.Spec.Interfaces = []laboratoryv1alpha1.InterfaceSpec{{Name: "eth0", Addr: laboratoryv1alpha1.AddrSpec{
    Type: laboratoryv1alpha1.AddrTypeStatic, IP: "10.0.0.2/24",
    Routes: []laboratoryv1alpha1.Route{{Dst: "10.1.0.0/16", Via: "10.0.0.1"}},
  }}}
  c := (&DeviceReconciler{NetConfigImage: "netconfig"}).netConfigInitContainer(d)
  if c == nil { t.Fatal("missing netconfig container") }
  var config []netconfigIface
  if err := json.Unmarshal([]byte(c.Env[0].Value), &config); err != nil { t.Fatal(err) }
  if len(config) != 1 || len(config[0].Routes) != 1 || config[0].Routes[0].Dst != "10.1.0.0/16" || config[0].Routes[0].Via != "10.0.0.1" { t.Fatalf("route lost: %+v", config) }
}
```
- [ ] **Step 6: Commit only Task 1 files in `laboratory`: `git add api/laboratory/v1alpha1/shared_types.go api/laboratory/v1alpha1/device_type_test.go internal/controller/laboratory/device_routes_test.go internal/controller/laboratory/lab_controller.go internal/nodeagent/device_reconciler.go config/crd/bases/laboratory.cybericebox.com_devices.yaml config/crd/bases/laboratory.cybericebox.com_labs.yaml charts/laboratory/crds/laboratory.cybericebox.com_devices.yaml charts/laboratory/crds/laboratory.cybericebox.com_labs.yaml && git commit -m 'feat(lab): remove unsupported vm device type'` (omit unchanged files from staging).**

### Task 2: Validate resources, routes, and single-address semantics in the backend model

**Files:** Modify `AP Backend/internal/model/exercise/{topology.go,version.go,errors.go,topology_test.go}`; use direct `k8s.io/apimachinery/pkg/api/resource` dependency in `go.mod`/`go.sum` only if required by Go tooling.

**Interfaces:** Produce `Device.Resources *DeviceResources`, `DeviceResources{CPURequest,MemoryRequest,CPULimit,MemoryLimit string}`, `IPConfig.Routes []Route`, `Route{Dst,Via string}`. Existing `Topology.validateStructure() error` performs the checks used by save/publish. Add distinct `ErrDeviceResourcesInvalid`, `ErrDeviceRouteInvalid`, `ErrDeviceStaticAddressCountInvalid` detail codes not already used. The user addendum adds `ErrFlagEnvironmentConflict`, checked by `ExerciseVersion.ValidateStructure` on draft save and publish.

- [ ] **Step 1: Extend `topology_test.go` with table cases using the existing `dev()` and `publishVariant()` helpers.** Include: old omitted fields; valid partial resource (`250m`,`256Mi`); zero/negative/malformed quantity; CPU request greater than limit; memory request greater than limit; forwarding device with resources; static zero/two CIDRs; static IPv4 and IPv6 routes; invalid destination/next hop/mixed family; non-static carrying a route/gateway/address; `DeviceType("vm")`. Assert `errors.Is(err, wantErr)` and exact offending device context where existing tests do so. The table should use this exact assertion pattern:

```go
for _, tc := range cases {
  t.Run(tc.name, func(t *testing.T) {
    v := exerciseModel.ExerciseVersion{Variants: []exerciseModel.Variant{publishVariant(tc.topo)}}
    err := v.ValidateStructure()
    if !errors.Is(err, tc.wantErr) { t.Fatalf("got %v, want %v", err, tc.wantErr) }
  })
}
```
- [ ] **Step 2: Run `go test ./internal/model/exercise -run 'TestValidate.*Topology|TestValidateForPublish' -count=1`; expect new cases to fail.**
- [ ] **Step 3: Add the typed structs and validation. Remove `DeviceTypeVM` from the production enum and the existing test helper `dev()`; use `resource.ParseQuantity` and `Quantity.Sign()/Cmp()`; `netip.ParsePrefix` and `netip.ParseAddr` for routes, comparing `Dst.Addr().Is4()` with `Via.Is4()`. Reject resource object on forwarding devices, including an allocated-but-empty object. Require `len(Addresses)==1` only for `static`, `len==0` otherwise; reject non-static gateway/routes. Keep empty `Resources=nil` legal. For resource errors, attach device name and field name to the distinct error.** Core types and comparison:

```go
type DeviceResources struct { CPURequest, MemoryRequest, CPULimit, MemoryLimit string }
type Route struct { Dst, Via string }

request, err := resource.ParseQuantity(d.Resources.CPURequest)
if err != nil || request.Sign() <= 0 { return ErrDeviceResourcesInvalid.WithContext("device", d.Name).WithContext("field", "cpuRequest").Err() }
if d.Resources.CPULimit != "" && request.Cmp(limit) > 0 { return ErrDeviceResourcesInvalid.WithContext("device", d.Name).WithContext("field", "cpuRequest").Err() }
```

- [ ] **Step 4: Run `go test ./internal/model/exercise -count=1`, `go run ./tools/checkerrorcodes internal pkg`, and `git diff --check`; expect pass.**
- [ ] **Step 5: Add red tests for a linked task targeting an ordinary env var and for two tasks targeting the same device+env name. Implement `Topology.validateFlagEnvTargets(tasks)` from `ExerciseVersion.ValidateStructure()` and return `ErrFlagEnvironmentConflict` with task/device/env context. Run both red and green tests.**
- [ ] **Step 6: Commit only owned backend model files and any `go.mod`/`go.sum` change: `git add internal/model/exercise/topology.go internal/model/exercise/version.go internal/model/exercise/errors.go internal/model/exercise/topology_test.go go.mod go.sum && git commit -m 'feat(exercise): validate topology resources routes and flag targets'` (omit unchanged module files).**

### Task 3: Roundtrip the API and carry settings into LabSpec

**Files:** Modify `AP Backend/internal/delivery/controller/http/handler/exercise/dto.go`; create/extend `dto_test.go` in that package; modify `AP Backend/internal/delivery/infrastructure/labagent/{translate.go,translate_test.go}`.

**Interfaces:** Produce optional PascalCase `Device.Resources` and `IP.Routes` in API DTOs, snake-case `resources` fields and lowercase `routes[].{dst,via}` in `LabSpec` JSON. Keep `BuildLabSpec(Topology) ([]byte, []*labpb.DeviceEnv, error)` signature.

- [ ] **Step 1: Add a DTO roundtrip test with one container carrying `Resources{CPURequest:"250m",MemoryLimit:"512Mi"}` and one static route; check `topologyToDTO(input).toDomain()` via `reflect.DeepEqual` on resource/route fields, marshal JSON to assert `Resources`/`Routes`, and marshal a legacy device to assert those keys are omitted. Add `TestBuildLabSpec_ResourcesAndRoutes` decoding raw JSON and asserting `resources.cpuRequest`, `resources.memoryLimit`, `interfaces[0].addr.routes[0].dst/via`; update `TestBuildLabSpec_InterfaceAddrModes` fixture to one static CIDR.** Representative assertion:

```go
got := topologyToDTO(input).toDomain()
if !reflect.DeepEqual(got.Devices[0].Resources, input.Devices[0].Resources) { t.Fatalf("resources lost: %#v", got.Devices[0].Resources) }
if !reflect.DeepEqual(got.Devices[0].Interfaces[0].IP.Routes, input.Devices[0].Interfaces[0].IP.Routes) { t.Fatalf("routes lost: %#v", got.Devices[0].Interfaces[0].IP.Routes) }
```
- [ ] **Step 2: Run `go test ./internal/delivery/controller/http/handler/exercise ./internal/delivery/infrastructure/labagent -run 'Test.*(Roundtrip|ResourcesAndRoutes|InterfaceAddrModes)' -count=1`; expect compile/test failure until fields are added.**
- [ ] **Step 3: Add `resourcesDTO` and `routeDTO`, map to/from domain in `toDomain`/`topologyToDTO`, and mirror `labResources`/`labRoute` in `translate.go`. Copy fields without quantity conversion; serialize `Resources` only when non-nil and routes only for static. Existing `buildInterface` may read `Addresses[0]` because Task 2 guarantees exactly one before save; document that precondition.** Wire shape:

```go
type routeDTO struct { Dst string `json:"Dst"`; Via string `json:"Via"` }
type resourcesDTO struct { CPURequest string `json:"CPURequest,omitempty"`; MemoryRequest string `json:"MemoryRequest,omitempty"`; CPULimit string `json:"CPULimit,omitempty"`; MemoryLimit string `json:"MemoryLimit,omitempty"` }
type labRoute struct { Dst string `json:"dst"`; Via string `json:"via"` }
type labResources struct { CPURequest string `json:"cpuRequest,omitempty"`; MemoryRequest string `json:"memoryRequest,omitempty"`; CPULimit string `json:"cpuLimit,omitempty"`; MemoryLimit string `json:"memoryLimit,omitempty"` }
```
- [ ] **Step 4: Run `go test ./internal/delivery/controller/http/handler/exercise ./internal/delivery/infrastructure/labagent -count=1` and `git diff --check`; expect pass.**
- [ ] **Step 5: Commit only owned backend delivery files: `git add internal/delivery/controller/http/handler/exercise/dto.go internal/delivery/controller/http/handler/exercise/dto_test.go internal/delivery/infrastructure/labagent/translate.go internal/delivery/infrastructure/labagent/translate_test.go && git commit -m 'feat(exercise): roundtrip and deploy topology settings'` (omit an uncreated test file).**

### Task 4: Mirror topology data and validation in the frontend

**Files:** Modify `admin-frontend/src/api/exercises/versions.ts`, `admin-frontend/src/lib/exerciseSchemas.ts`, `admin-frontend/src/lib/exerciseSchemas.test.ts`; add a small `src/lib/ipValidation.ts` and test only if the existing IPv4 helpers cannot accurately support IPv6 routes.

**Interfaces:** Add `Resources?: DeviceResourcesDTO` with four optional quantity strings, `Routes?: RouteDTO[]` to `IPConfigDTO`; normalized form objects use four concrete `""` strings and `Routes: []`. `emptyDevice`/`emptyInterface`, normalization, and `toSaveDraftInput` preserve these fields with empty objects omitted. Reject `vm` as new form data.

- [ ] **Step 1: Add tests to `exerciseSchemas.test.ts` for legacy DTO normalization, exact serialization of partial resources and two routes, omission of fully empty resources, one static CIDR, forwarding-device resources, and clearing non-static address/gateway/routes. Add IPv4 and IPv6 route family cases, including mixed-family rejection, and `vm` rejection. Add task flag target conflicts (ordinary device env or another task), plus a same-name binding on two different devices that is allowed.** Example shape:

```ts
const d = emptyDevice()
d.Resources.CPURequest = "250m"
d.Interfaces[0].IP = { Type: "static", Addresses: ["10.0.0.2/24"], Gateway: "", Routes: [{ Dst: "10.1.0.0/16", Via: "10.0.0.1" }] }
expect(toSaveDraftInput({ ...emptyDraft(), Variants: [{ ...emptyVariant(1), Topology: { ...emptyVariant(1).Topology, Devices: [d] } }] }).Variants[0].Topology.Devices?.[0].Resources).toEqual({ CPURequest: "250m" })
```

- [ ] **Step 2: Run `npm test -- src/lib/exerciseSchemas.test.ts`; expect new cases to fail.**
- [ ] **Step 3: Add DTO/normalized types and Zod checks mirroring Task 2. For resource syntax, use an explicit bounded Kubernetes Quantity validator (integer/decimal exponent or SI/binary suffix) and reject nonpositive values; test all accepted suffixes used by the operator. For IP syntax, add `ipaddr.js` via `npm install ipaddr.js` (and `@types/ipaddr.js` if needed) and isolate parsing in `ipValidation.ts`; this handles both IPv4 and IPv6 without a permissive regex. Perform family comparison on parsed addresses, not string prefixes. Keep server validation authoritative and map errors to new `admin.ex.val.*` keys.** Type/serialization anchor:

```ts
export type RouteDTO = { Dst: string; Via: string }
export type DeviceResourcesDTO = { CPURequest?: string; MemoryRequest?: string; CPULimit?: string; MemoryLimit?: string }
export type IPConfigDTO = { Type: IPType; Addresses?: string[]; Gateway?: string; Routes?: RouteDTO[] }
const resources = Object.fromEntries(Object.entries(d.Resources).filter(([, value]) => value !== "")) as DeviceResourcesDTO
return { ...base, ...(Object.keys(resources).length ? { Resources: resources } : {}), Interfaces: d.Interfaces.map(interfaceToDTO) }
```
- [ ] **Step 4: Run `npm test -- src/lib/exerciseSchemas.test.ts` and `npx tsc --noEmit`; expect pass.**
- [ ] **Step 5: Commit owned frontend model files only; stage paths explicitly and commit `feat(exercises): validate topology settings in editor`.**

### Task 5: Provide compact resource, address and route controls

**Files:** Modify `admin-frontend/src/components/exercises/{DeviceCard,InterfaceForm}.tsx` and their tests; add `ResourceFields.tsx` only if it keeps `DeviceCard` focused; modify `messages/{uk,en}.json` narrowly.

**Interfaces:** Controls edit the Task 4 normalized form. `onTypeChange` clears resources when switching to switch/hub. `IP.Type` change clears `Addresses`, `Gateway`, `Routes`; static mode renders one CIDR input bound to `Addresses[0]`, and route rows bound to `Routes[i]`.

- [ ] **Step 1: Add component tests for four resource fields with field labels and field-level validation, one static address input with no Add Address button, adding/removing routes, IP mode cleanup, and switching container→switch clearing resources. Test error text beside destination/next-hop fields.**
- [ ] **Step 2: Run `npm test -- src/components/exercises/DeviceCard.test.tsx src/components/exercises/InterfaceForm.test.tsx`; expect failures for absent controls.**
- [ ] **Step 3: Render two compact resource rows (`CPU`, `Памʼять`) under Basic with `Запит` and `Ліміт` columns. Replace `AddressList` with one controlled `Input`; on empty static entry set `Addresses` to `[""]` so field errors have a target. Use `useFieldArray` for Routes, with `Dst` and `Via` controls and local add/remove action. Keep all label/help/error elements outside decorative nested cards. Add matching English/Ukrainian copy for resource and route fields.** The address and cleanup bindings:

```tsx
<Input value={addrField.value[0] ?? ""} onChange={(event) => addrField.onChange([event.target.value])} disabled={disabled} placeholder="10.0.0.2/24" />
// In the IP.Type onChange handler when value !== "static":
setValue(`${name}.${ii}.IP.Addresses`, [], { shouldDirty: true })
setValue(`${name}.${ii}.IP.Gateway`, "", { shouldDirty: true })
setValue(`${name}.${ii}.IP.Routes`, [], { shouldDirty: true })
```
- [ ] **Step 4: Run the focused component tests, `npx tsc --noEmit`, and `npm run lint`; expect pass.**
- [ ] **Step 5: Stage only owned components/tests and hunk-stage only owned locale keys if existing user changes overlap; commit `feat(exercises): edit container resources and static routes`.**

### Task 6: Compact topology layout and remove VM from adjacent UI/copy

**Files:** Modify `admin-frontend/src/components/exercises/{TopologySection,TopologyDiagram,NetworkToggles,DeviceCard,TaskForm,FlagInput}.tsx`, `src/app/globals.css`, `messages/{uk,en}.json`, tests `TopologySection.test.tsx`, `TopologyDiagram.test.tsx`, `DeviceCard.test.tsx`, `NetworkToggles.test.tsx`, `TaskAccordion.test.tsx`, `FlagInput.test.tsx`, and affected TaskForm tests. `FlagInput.tsx`, `FlagInput.test.tsx`, and both locale files already contain user changes: inspect each diff and touch only VM-related hunks.

**Interfaces:** One vertical grouped navigation with General, Devices (device list and add action), Connections, Diagram; no second top tab strip. One right bordered panel holds the selected section, including the graph. DeviceCard alone has horizontal subsection tabs. Diagram uses current topology and VisualRender positions; attachment to tasks is deferred. Preserve `useEditorPosition("topologySection")` and `useEditorPosition("devicePanel")` persistence. Supported type select has only container/switch/hub; linked flag device list only containers.

- [ ] **Step 1: Add tests asserting one vertical grouped navigation and no top tab strip, a separate diagram panel with no connection list, a connection-list panel with no diagram, one outer settings border, no nested DeviceCard border/third column, add-device action in the device group header, gateway rows without cards, selected/hover/focus classes, horizontal device subtab list, subtab persistence across two containers and Basic fallback on switch, and no `vm` in device select or linked-device help. Add graph tests for device/forwarding/gateway shapes, readable endpoint labels, and stored-position drag.**
- [ ] **Step 2: Run focused tests with `npm test -- src/components/exercises/TopologySection.test.tsx src/components/exercises/DeviceCard.test.tsx src/components/exercises/NetworkToggles.test.tsx`; expect new assertions to fail.**
- [ ] **Step 3: Build one vertical grouped navigation with General, Devices and its entries, Connections, Diagram; do not add a top tab strip. Put add-device action into Devices group header; wrap the selected content in one right bordered panel. Render Diagram separately from Connections, with the remaining main-column width, and improve graph layout/shapes/port labels while keeping drag and VisualRender persistence. Remove DeviceCard's own outer border and `.exercise-device-layout` third column; use a horizontal, wrapping/scroll-safe subsection tab row. Remove duplicated removal/action headings; keep device removal only in left list. Convert gateway cards to flat rows. Restrict DeviceCard type choices and TaskForm linked devices to container; revise adjacent VM references in help/errors, comments, and tests. In particular, update `staticTypeHelp`/`unlinkedTypeHelp`, `linkedDeviceHelp`/`linkedDeviceUnavailable`, and both dirty `FlagInput` and `TaskAccordion` tests without staging pre-existing edits. Delete unused `exercise-device-layout` CSS.** Layout anchor:

```tsx
const topologyNavClass = "min-w-0 rounded-md border border-border p-2"
const topologyPanelClass = "min-w-0 rounded-md border border-border p-3"
const deviceTabsClass = "flex min-w-0 flex-wrap gap-1 border-b border-border pb-2"
```
- [ ] **Step 4: Run focused tests, `npm test`, `npm run lint`, `npm run build`. Inspect in a browser at approximately 1440, 900, and 390 px; verify long names, multiple interfaces/routes, keyboard focus, empty state, and no horizontal clipping. Expect pass and record any environment-specific inability to do a browser check.**
- [ ] **Step 5: Stage only Task 6 files/hunks and commit `refactor(exercises): compact topology editor and remove vm copy`.**

### Task 7: Show task-owned flag bindings on the device and align copy

**Files:** Modify `admin-frontend/src/components/exercises/{DeviceCard,TaskForm}.tsx`, `DeviceCard.test.tsx` and `TaskForm.test.tsx`, `messages/{uk,en}.json`; retain any pre-existing dirty flag-help changes in those locale files.

**Interfaces:** The task remains the only editor for `LinkedDeviceID`/`DeviceFlagVar`; `EnvVarsList` receives `variantIndex`/`deviceIndex` and derives bound tasks from form state. A read-only binding row names the task and variable and navigates to that task. Backend Task 2 and frontend Task 4 reject conflicting names on save.

**User addendum:** In the topology left column, `Пристрої` is a collapsible group heading, not a second selected item. Only the selected device row is highlighted; collapsing the list keeps the right-hand device editor open. Adding a device expands the group.

- [ ] **Step 1: Add a component test with one linked task and one ordinary env var. Open the device Env tab; assert the task flag binding and variable name are visible and read-only, and activating the task reference selects that task. Add a test that a conflicting name shows a field-level error beside `DeviceFlagVar`. Run the tests to see them fail.**
- [ ] **Step 2: Implement the derived display from `useWatch` task and device state without appending it to `EnvVars`, and connect the task reference through the existing editor position/navigation mechanism. Keep ordinary env var editing unchanged. Update the transfer section and tooltip copy from «прапорець» to «прапор» in both locale files where applicable; use natural English in `en.json`.**
- [ ] **Step 3: Run `npm test -- src/components/exercises/DeviceCard.test.tsx src/components/exercises/TaskForm.test.tsx src/lib/exerciseSchemas.test.ts`, `npx tsc --noEmit`, and `npm run lint`. Stage only owned changes/hunks; commit `feat(exercises): show task flag bindings on devices`.**

### Task 8: Cross-repository acceptance and drift audit

**Files:** No product-file edits unless a failed check points to a Task 1–7 owner. Record verification evidence in the final handoff; do not generate an extra status artifact.

**Interfaces:** One saved draft roundtrip on current API and one generated LabSpec fixture prove that an author-entered resource and route survive all three layers; no new endpoint or SQL migration.

- [ ] **Step 1: Run `rg -n 'DeviceTypeVM|"vm"|container/vm|контейнер.*віртуаль|container.*virtual'` in the scoped topology/editor/operator paths and inspect every hit; remove only stale product-facing VM support, not unrelated infrastructure documentation.**
- [ ] **Step 2: Run `go test ./internal/model/exercise ./internal/delivery/controller/http/handler/exercise ./internal/delivery/infrastructure/labagent -count=1` in AP Backend, `go run ./tools/checkerrorcodes internal pkg`, and `go run ./tools/checklayers internal/model`. Run `go test ./api/laboratory/v1alpha1 ./internal/controller/laboratory -count=1`, `make manifests`, and compare the two checked-in CRD copies in laboratory. Run `npm test`, `npm run lint`, and `npm run build` in admin-frontend. Report exactly which checks pass or cannot run.**
- [ ] **Step 3: Verify each repo's `git status --short`, `git diff --check`, and task-scoped commits. Ensure the pre-existing admin flag/help edits, `.claude/`, backend `graphify-out/`, and operator `agent`/`graphify-out/` were not staged.**
- [ ] **Step 4: Deliver a concise summary with three repo commit IDs, verified scope, browser-check status, and any residual limitation (notably multiple static IPs remain intentionally unsupported).**

---

## Continuation: fixed ports and canvas-first workspace

### Task 9: Enforce switch/hub ports in the laboratory operator

**Files:** Modify `laboratory/api/laboratory/v1alpha1/shared_types.go` (comment only) and `laboratory/internal/controller/laboratory/lab_controller.go`; create `laboratory/internal/controller/laboratory/lab_ports_test.go`. The CRD schema already permits `EndpointSpec.Interface` as a string; generate and compare manifests but commit generated files only if source-comment regeneration changes them.

**Interfaces:** `validForwardingPort(name string) bool` recognizes exactly `GigabitEthernet0/1` through `GigabitEthernet0/48`; `LabReconciler.validateGraph(*Lab)` rejects invalid/reused switch/hub ports before `materializeConnections`; `connectionName` remains stable for already DNS-safe endpoints and returns a deterministic DNS-safe name for an endpoint containing uppercase or `/`.

- [ ] **Step 1: Add table tests in `lab_ports_test.go`.** Build a `Lab{Spec: LabSpec{Devices: []DeviceTemplate{{Name:"sw", Type:DeviceTypeUnmanagedSwitch}, {Name:"host", Type:DeviceTypeContainer, Interfaces: []InterfaceSpec{{Name:"eth0"}}}}, Connections: ...}}`, invoke `(&LabReconciler{}).validateGraph(&lab)`, and assert that `GigabitEthernet0/1` and `/48` pass; empty, `/0`, `/49`, lowercase and a reused `/1` fail with a reason naming `sw`. Add 48 distinct connections and a 49th using `/1`; assert failure. Add two switches both using `/1`; assert success. Verify `connectionName("lab", endpoints)` is a DNS subdomain, independent of endpoint order, unchanged for `eth0` endpoints, and different for `GigabitEthernet0/1` versus `GigabitEthernet0-1`.
- [ ] **Step 2: Run `go test ./internal/controller/laboratory -run 'TestForwardingPort|TestConnectionName' -count=1` in `laboratory`; expect new cases to fail.**
- [ ] **Step 3: Add a numeric parser and validate occupied ports inside the existing endpoint loop before the current switch/hub `continue`.** Preserve container checks and gateway handling. The core rule is:

```go
func validForwardingPort(name string) bool {
    const prefix = "GigabitEthernet0/"
    if !strings.HasPrefix(name, prefix) { return false }
    n, err := strconv.Atoi(strings.TrimPrefix(name, prefix))
    return err == nil && n >= 1 && n <= 48 && name == fmt.Sprintf("%s%d", prefix, n)
}
// In validateGraph, for a switch/hub endpoint:
if !validForwardingPort(ep.Interface) { return fmt.Errorf("InvalidForwardingPort: device %q port %q", ep.Device, ep.Interface) }
key := ep.Device + "/" + ep.Interface
if usedIfaces[key] { return fmt.Errorf("DuplicateEndpointInterface: device %q port %q", ep.Device, ep.Interface) }
usedIfaces[key] = true
```

For `connectionName`, keep the existing safe-name branch; when either endpoint introduces unsafe characters, hash a length-delimited, sorted serialization of full endpoint `(device, interface)` pairs and append at least 96 hash bits to a lowercase DNS-safe lab prefix. Use the same function for materialize and prune; do not derive an OVS port from the logical name. Update `EndpointSpec.Interface`'s comment accordingly.
- [ ] **Step 4: Run the focused tests, `go test ./internal/controller/laboratory ./api/laboratory/v1alpha1 -count=1`, `make manifests`, and `git diff --check`; confirm generated CRDs remain aligned.**
- [ ] **Step 5: Commit only owned operator files with `git add api/laboratory/v1alpha1/shared_types.go internal/controller/laboratory/lab_controller.go internal/controller/laboratory/lab_ports_test.go` plus genuinely changed generated CRDs, then `git commit -m 'feat(lab): enforce fixed forwarding ports'`.** Leave `agent` and `graphify-out/` untouched.

### Task 10: Mirror port occupancy in the backend and block invalid test deploys

**Files:** Modify `AP Backend/internal/model/exercise/{topology.go,version.go,errors.go,topology_test.go}`, `AP Backend/internal/useCase/exercise/{deploy.go,deploy_test.go}`, `AP Backend/internal/delivery/infrastructure/labagent/translate_test.go`.

**Interfaces:** `validForwardingPort(name string) bool` mirrors Task 9; `ErrForwardingPortInvalid` uses next unused exercise detail code (currently 43; recheck before writing); `ErrPortInUse` covers reuse; `Variant.ValidateTopologyForDeploy() error` checks structure and graph without imposing publication-only description requirements. Existing `buildEndpoint` sends the full `Interface` unchanged.

- [ ] **Step 1: Add red model/translator tests.** In `topology_test.go`, replace the old valid empty switch endpoint fixture with `GigabitEthernet0/1` and `/2`. Add cases for `/0`, `/49`, empty, lowercase, reused `/1`, 48 occupied ports + a 49th, and `/1` on two different forwarding devices. In `translate_test.go`, assert `BuildLabSpec` JSON contains the exact `"interface":"GigabitEthernet0/1"` for a switch endpoint. Use `errors.Is` against the new invalid-port error or `ErrPortInUse` and inspect context where supported.
- [ ] **Step 2: Run `go test ./internal/model/exercise ./internal/delivery/infrastructure/labagent -run 'TestValidateForPublish_Graph|TestBuildLabSpec_Connections' -count=1`; expect the new cases to fail.**
- [ ] **Step 3: In `Topology.validateGraph`, validate the exact forwarding-port string and then apply the existing `(deviceID, interface)` occupied-port map to forwarding devices as well as containers.** Do not add 48 `Device.Interfaces` or change JSON DTO shape. Add `Variant.ValidateTopologyForDeploy` in `version.go`:

```go
func (v Variant) ValidateTopologyForDeploy() error {
    if err := v.Topology.validateStructure(); err != nil { return err }
    return v.Topology.validateGraph(v.Tasks)
}
```

In `DeployVariantTest`, call it immediately after `loadVariant` and before decryption, lease creation or `DeployLab`. Keep full `ValidateForPublish` for publication. Assign a distinct error code to `ErrForwardingPortInvalid`; update `errors.go`'s next-free-code comment.
- [ ] **Step 4: Add a use-case regression test with an unpublished saved variant whose switch endpoint uses `/49`. Assert `DeployVariantTest` returns the invalid-port error and never calls `CreateExerciseTestDeploy` or infrastructure deployment. Run `go test ./internal/useCase/exercise -run 'TestDeployVariantTest' -count=1`, then focused model/translator tests and `go run ./tools/checkerrorcodes internal pkg`.**
- [ ] **Step 5: Commit only Task 10 paths with `git add internal/model/exercise/topology.go internal/model/exercise/version.go internal/model/exercise/errors.go internal/model/exercise/topology_test.go internal/useCase/exercise/deploy.go internal/useCase/exercise/deploy_test.go internal/delivery/infrastructure/labagent/translate_test.go` and `git commit -m 'feat(exercise): validate forwarding ports before deploy'`.** Preserve `graphify-out/`.

### Task 11: Expose fixed free ports in the existing connection editor

**Files:** Create `admin-frontend/src/lib/topologyPorts.ts` and `topologyPorts.test.ts`; modify `src/lib/{exerciseSchemas.ts,exerciseSchemas.test.ts}`, `src/components/exercises/{ConnectionList.tsx,ConnectionList.test.tsx}`, `messages/{uk,en}.json` narrowly.

**Interfaces:** `FORWARDING_PORTS: readonly string[]`, `isForwardingPort(name: string): boolean`, and `availableForwardingPorts(topology: Pick<TopologyFormValues, "Connections">, deviceID: string, editing?: { connectionIndex: number; side: number }): string[]` are pure shared helpers used by list, connection dialog and validation. Values are full names; UI may show `Gi0/N`.

- [ ] **Step 1: Add red tests.** Assert 48 names from `/1` to `/48`, reject `/0` and `/49`, remove a used port, keep the current row's own port during editing, and return it after removing that row. Add Zod cases for wrong/reused forwarding ports; change old switch-endpoint tests to full names. In `ConnectionList.test.tsx`, assert the select lists `Gi0/1`/`Gi0/2` when free and omits a port used by another row.
- [ ] **Step 2: Run `npm test -- src/lib/topologyPorts.test.ts src/lib/exerciseSchemas.test.ts src/components/exercises/ConnectionList.test.tsx`; expect failures.**
- [ ] **Step 3: Implement the pure helper and use it in `topologySchema.superRefine` and both `ConnectionList.optionsForNode`/`endpointOptions`.** Use exact full strings for `NormalizedEndpoint.Interface` and serialization, select the first free port only as a suggestion, and show a localized explanation when all 48 are occupied. Keep container, VPN and Internet endpoint rules unchanged. Helper skeleton:

```ts
export const FORWARDING_PORTS = Object.freeze(Array.from({ length: 48 }, (_, i) => `GigabitEthernet0/${i + 1}`))
export function isForwardingPort(name: string): boolean { return FORWARDING_PORTS.includes(name) }
export function availableForwardingPorts(topology: Pick<TopologyFormValues, "Connections">, deviceID: string, editing?: { connectionIndex: number; side: number }): string[] {
  const used = new Set(topology.Connections.flatMap((c, ci) => c.Endpoints.flatMap((ep, side) =>
    ep.Kind === "device" && ep.DeviceID === deviceID && !(editing?.connectionIndex === ci && editing.side === side) ? [ep.Interface] : [])))
  return FORWARDING_PORTS.filter((port) => !used.has(port))
}
```

- [ ] **Step 4: Run the focused tests, `npx tsc --noEmit`, and `npm run lint`. Resolve any server/console validation mismatch without changing the operator's 48-port rule.**
- [ ] **Step 5: Commit only owned files and locale hunks with `git commit -m 'feat(exercises): select free forwarding ports'`; preserve unrelated dirty `FlagInput`, notification and locale edits.**

### Task 12: Make the canvas the primary topology workspace

**Files:** Modify `admin-frontend/src/components/exercises/{TopologySection,TopologyDiagram}.tsx` and their tests; add small local components if needed.

**Interfaces:** One shared selected device/connection state drives the diagram and auxiliary lists. A canvas click selects only; it does not open settings. Adding a device creates a valid device immediately at a visible position and selects it. Lists are compact and collapsible, while the canvas fills the available editor height; inner panels scroll, not the outer page. Deleting a device with links requires confirmation and removes its links atomically.

- [ ] **Step 1:** Add failing component tests for selection synchronization, immediate creation without dialog, collapsible lists, and linked-device deletion confirmation/cascade. Run `npm test -- src/components/exercises/TopologySection.test.tsx src/components/exercises/TopologyDiagram.test.tsx` and observe failure.
- [ ] **Step 2:** Restructure `TopologySection` around the diagram, passing selection and add/delete callbacks. Preserve current form state and responsive layout; move settings behind an explicit action. Make diagram hit targets keyboard focusable and provide descriptive labels.
- [ ] **Step 3:** Run focused tests, `npx tsc --noEmit`, `npm run lint`, and `git diff --check`; commit only task-owned files as `feat(exercises): make topology canvas primary`.

### Task 13: Connect devices explicitly through a port-selection dialog

**Files:** Modify `TopologyDiagram.tsx`, `ConnectionList.tsx`, `TopologySection.tsx`; add `TopologyConnectionDialog.tsx` and component tests.

**Interfaces:** A visible «З'єднати» action enters connect mode. Select first and second devices, then pick available endpoint ports in a dialog; Save inserts one connection, Cancel/Escape changes nothing. The 48-port helper from Task 11 is the single source of free switch/hub ports. Existing connection edits and gateway rules remain intact.

- [ ] **Step 1:** Add failing UI tests for enter/cancel/complete connect mode, unavailable used ports, keyboard cancellation, and saved endpoint names. Run the focused tests and observe failure.
- [ ] **Step 2:** Implement state transitions and dialog with explicit confirm. Reuse the shared port helper and existing form update machinery; never create a connection merely by clicking a node outside connect mode.
- [ ] **Step 3:** Run focused tests, typecheck, lint, and commit task-owned files as `feat(exercises): connect topology nodes on canvas`.

### Task 14: Add device settings access and topology icon assets

**Files:** Modify `TopologyDiagram.tsx`, `TopologySection.tsx`, `DeviceCard.tsx`; add focused tests and local icon assets under `public/topology/`.

**Interfaces:** Right click or keyboard context-menu key on a node offers only «Налаштувати» initially; a visible action offers the same path for touch. The settings dialog edits the already-created device; Cancel does not delete it. Default icon mapping is server for container, switch for switch, hub for hub, with a per-device override stored by ID in `VisualRender`. Icons remain unaltered; selection and future status are separate overlays. Do not introduce runtime status yet.

- [ ] **Step 1:** Add failing UI tests for context menu, visible settings action, edit/save/cancel and icon default/override persistence. Run focused tests and observe failure.
- [ ] **Step 2:** Integrate accessible context-menu interaction and existing device editor in a scrollable dialog. Add the approved unmodified icon assets with source/license attribution; render selection ring separately.
- [ ] **Step 3:** Run focused tests, typecheck, lint, inspect bundle and icon rendering, then commit only task-owned files as `feat(exercises): configure canvas devices with topology icons`.

### Task 15: Whole-path acceptance and visual review

**Files:** Product files only where a failing check identifies a defect. Do not stage unrelated dirty work.

- [ ] **Step 1:** Exercise a 48-port switch and 49th-connection rejection across frontend schema, backend publish/test deploy and operator reconcile; confirm full port names survive serialization and Kubernetes connection resource names are valid. Verify two switches can each use `GigabitEthernet0/1`.
- [ ] **Step 2:** Run scoped Go tests in backend/operator, error-code and layer checks, operator manifests and CRD comparison, frontend tests, typecheck, lint and build. State precisely which passed; do not call a partial suite complete.
- [ ] **Step 3:** Inspect topology UI at desktop and narrow widths, keyboard/right-click/hover states, many-device layout and overflow. Fix only high-impact findings with red-to-green regressions. Run the project's design detector once on changed UI files.
- [ ] **Step 4:** Review the combined diff and statuses of all three repos; verify only task-owned commits exist and no unrelated dirty files were staged. Report remaining limitations: logical 48-port cap without guaranteed bandwidth, no live runtime status, no participant-facing canvas yet.
