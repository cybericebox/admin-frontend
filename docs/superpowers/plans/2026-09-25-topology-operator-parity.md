# Topology Operator Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the admin a compact topology editor that faithfully saves and deploys supported container, network, resource, and route settings without exposing a fictitious VM type.

**Architecture:** The operator remains the authoritative LabSpec shape. The backend adds typed optional resource and route fields to its JSONB snapshot, validates them before saving, and copies them into the agent's LabSpec JSON; the frontend mirrors that contract and reorganizes only the topology editor. Keep the existing API route, snapshots, connectivity model, and operator resource/route semantics.

**Tech Stack:** Go 1.27, Kubernetes Quantity/netip, kubebuilder/controller-gen, React 19, Next.js 16, TypeScript, Zod 4, react-hook-form, Vitest, Tailwind.

**Spec:** `../specs/2026-09-25-topology-operator-parity-design.md`

## Global Constraints

- Work in the existing `admin-frontend/feature/base-redesign`, `AP Backend/feature/superadmin-infrastructure-read`, and `laboratory/feature/lab-access-acl` branches; do not stage unrelated dirty files.
- Supported device values are exactly `container`, `unmanaged-switch`, `hub`; the user confirmed no saved VM devices.
- Keep `Addresses []string` in the API/JSONB snapshot, but require exactly one CIDR for `static` and zero for other modes; multiple static IPs are out of scope.
- Resource fields are optional Kubernetes Quantity strings; each present value must be positive, and a paired request must not exceed its limit.
- Routes exist only for static IP; each has required `Dst` CIDR and `Via` IP of the same family.
- Keep VPN/Internet, DHCP, connections, canvas coordinates, secrets, external exposure, and test deployment behavior unchanged. Do not add test-list UI or API.
- Match existing restrained palette, typography, accessible labels and focus behavior; verify wide, intermediate, and narrow screens visually.

## File/ownership map

| Repository | Files | Responsibility |
| --- | --- | --- |
| laboratory | `api/laboratory/v1alpha1/shared_types.go`, generated CRDs in `config/crd/bases/` and `charts/laboratory/crds/`, operator tests/comments including `internal/nodeagent/device_reconciler.go` | Public device enum and CRD parity; existing resource/route execution stays intact |
| AP Backend | `internal/model/exercise/topology.go`, `errors.go`, `topology_test.go` | Snapshot types and authoritative shape validation |
| AP Backend | `internal/delivery/controller/http/handler/exercise/dto.go` and tests; `internal/delivery/infrastructure/labagent/translate.go` and tests | API roundtrip and LabSpec JSON mapping |
| admin-frontend | `src/api/exercises/versions.ts`, `src/lib/exerciseSchemas.ts` and tests | Optional DTO fields, normalized form values, serialization and validation |
| admin-frontend | `src/components/exercises/{DeviceCard,InterfaceForm,TopologySection,NetworkToggles,TaskForm,FlagInput}.tsx`, related tests including `TaskAccordion.test.tsx`, `src/app/globals.css`, `messages/{uk,en}.json` | Editor fields/layout and container-only copy |

## Review Focus

1. An old snapshot omitting resources/routes must open, save, and read back without adding invalid empty API objects (Tasks 2, 4).
2. A non-static IP switched from static must not retain its old address, gateway, or routes in form state or API payload (Tasks 2, 4, 5).
3. A route such as IPv6 `2001:db8:1::/64` via `2001:db8::1` must pass, while a mixed-family pair must fail (Tasks 2, 4).
4. A forwarding device with resource values must be rejected by API even if a forged client sends them (Task 2).
5. Selecting another device must keep the available horizontal subtab; selecting a switch while on a container-only subtab must show Basic with usable focus (Task 6).

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

**Files:** Modify `AP Backend/internal/model/exercise/{topology.go,errors.go,topology_test.go}`; use direct `k8s.io/apimachinery/pkg/api/resource` dependency in `go.mod`/`go.sum` only if required by Go tooling.

**Interfaces:** Produce `Device.Resources *DeviceResources`, `DeviceResources{CPURequest,MemoryRequest,CPULimit,MemoryLimit string}`, `IPConfig.Routes []Route`, `Route{Dst,Via string}`. Existing `Topology.validateStructure() error` performs the checks used by save/publish. Add distinct `ErrDeviceResourcesInvalid`, `ErrDeviceRouteInvalid`, `ErrDeviceStaticAddressCountInvalid` detail codes not already used.

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
- [ ] **Step 5: Commit only owned backend model files and any `go.mod`/`go.sum` change: `git add internal/model/exercise/topology.go internal/model/exercise/errors.go internal/model/exercise/topology_test.go go.mod go.sum && git commit -m 'feat(exercise): validate topology resources and routes'` (omit unchanged module files).**

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

- [ ] **Step 1: Add tests to `exerciseSchemas.test.ts` for legacy DTO normalization, exact serialization of partial resources and two routes, omission of fully empty resources, one static CIDR, forwarding-device resources, and clearing non-static address/gateway/routes. Add IPv4 and IPv6 route family cases, including mixed-family rejection, and `vm` rejection.** Example shape:

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

**Files:** Modify `admin-frontend/src/components/exercises/{TopologySection,NetworkToggles,DeviceCard,TaskForm,FlagInput}.tsx`, `src/app/globals.css`, `messages/{uk,en}.json`, tests `TopologySection.test.tsx`, `DeviceCard.test.tsx`, `NetworkToggles.test.tsx`, `TaskAccordion.test.tsx`, `FlagInput.test.tsx`, and affected TaskForm tests. `FlagInput.tsx`, `FlagInput.test.tsx`, and both locale files already contain user changes: inspect each diff and touch only VM-related hunks.

**Interfaces:** One `exercise-settings-layout` left navigation + one right bordered panel; DeviceCard horizontal subsection tabs. Preserve `useEditorPosition("topologySection")` and `useEditorPosition("devicePanel")` persistence. Supported type select has only container/switch/hub; linked flag device list only containers.

- [ ] **Step 1: Add tests asserting one outer settings border, no nested DeviceCard border/third column, add-device action in left nav header, gateway rows without cards, selected/hover/focus classes, horizontal tab list, subtab persistence across two containers and Basic fallback on switch, and no `vm` in device select or linked-device help.**
- [ ] **Step 2: Run focused tests with `npm test -- src/components/exercises/TopologySection.test.tsx src/components/exercises/DeviceCard.test.tsx src/components/exercises/NetworkToggles.test.tsx`; expect new assertions to fail.**
- [ ] **Step 3: Move the `TopologySection` title and Add Device into the left nav header; wrap right content in one bordered panel with responsive padding. Remove DeviceCard's own outer border and `.exercise-device-layout` third column; use a horizontal, wrapping/scroll-safe subsection tab row. Remove duplicated removal/action headings; keep device removal only in left list. Convert gateway cards to flat rows. Restrict DeviceCard type choices and TaskForm linked devices to container; revise adjacent VM references in help/errors, comments, and tests. In particular, update `staticTypeHelp`/`unlinkedTypeHelp`, `linkedDeviceHelp`/`linkedDeviceUnavailable`, and both dirty `FlagInput` and `TaskAccordion` tests without staging pre-existing edits. Delete unused `exercise-device-layout` CSS.** Layout anchor:

```tsx
const topologyNavClass = "min-w-0 rounded-md border border-border p-2"
const topologyPanelClass = "min-w-0 rounded-md border border-border p-3"
const deviceTabsClass = "flex min-w-0 flex-wrap gap-1 border-b border-border pb-2"
```
- [ ] **Step 4: Run focused tests, `npm test`, `npm run lint`, `npm run build`. Inspect in a browser at approximately 1440, 900, and 390 px; verify long names, multiple interfaces/routes, keyboard focus, empty state, and no horizontal clipping. Expect pass and record any environment-specific inability to do a browser check.**
- [ ] **Step 5: Stage only Task 6 files/hunks and commit `refactor(exercises): compact topology editor and remove vm copy`.**

### Task 7: Cross-repository acceptance and drift audit

**Files:** No product-file edits unless a failed check points to a Task 1–6 owner. Record verification evidence in the final handoff; do not generate an extra status artifact.

**Interfaces:** One saved draft roundtrip on current API and one generated LabSpec fixture prove that an author-entered resource and route survive all three layers; no new endpoint or SQL migration.

- [ ] **Step 1: Run `rg -n 'DeviceTypeVM|"vm"|container/vm|контейнер.*віртуаль|container.*virtual'` in the scoped topology/editor/operator paths and inspect every hit; remove only stale product-facing VM support, not unrelated infrastructure documentation.**
- [ ] **Step 2: Run `go test ./internal/model/exercise ./internal/delivery/controller/http/handler/exercise ./internal/delivery/infrastructure/labagent -count=1` in AP Backend, `go run ./tools/checkerrorcodes internal pkg`, and `go run ./tools/checklayers internal/model`. Run `go test ./api/laboratory/v1alpha1 ./internal/controller/laboratory -count=1`, `make manifests`, and compare the two checked-in CRD copies in laboratory. Run `npm test`, `npm run lint`, and `npm run build` in admin-frontend. Report exactly which checks pass or cannot run.**
- [ ] **Step 3: Verify each repo's `git status --short`, `git diff --check`, and task-scoped commits. Ensure the pre-existing admin flag/help edits, `.claude/`, backend `graphify-out/`, and operator `agent`/`graphify-out/` were not staged.**
- [ ] **Step 4: Deliver a concise summary with three repo commit IDs, verified scope, browser-check status, and any residual limitation (notably multiple static IPs remain intentionally unsupported).**
