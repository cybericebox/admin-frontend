/**
 * exerciseSchemas.ts — zod mirror of the domain validation for exercise versions
 * (inside the backend's internal/model/exercise) + editor form types and factories.
 *
 * Validation here catches errors BEFORE the request; the server is still authoritative.
 * The schemas describe DraftFormValues (form is 1:1 with SaveDraftInput; one difference:
 * External in the form is {Enabled, Port, Protocol} instead of a nullable object).
 */
import { z } from "zod"
import { t } from "@/i18n/t"
import type {
  ConnectionDTO,
  DeviceDTO,
  InterfaceDTO,
  NormalizedDevice,
  NormalizedInterface,
  NormalizedTask,
  NormalizedTopology,
  NormalizedVariant,
  PlaceholderDTO,
  PlaceholderKind,
  Protocol,
  SaveDraftInput,
  TaskDTO,
  TopologyDTO,
  VariantDTO,
  Version,
} from "@/api/exercises/versions"

// ── Regexes and parsers (mirror the domain) ─────────────────────────────────────

export const DNS_LABEL_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/
// MAC requires ONE consistent separator across all octets (all ":" OR all "-"):
// net.ParseMAC rejects mixed separators like "02:42-ac:11:00:02".
export const MAC_RE = /^[0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){5}$|^[0-9A-Fa-f]{2}(-[0-9A-Fa-f]{2}){5}$/
// Strict octet: 0–255 with no leading zeros (Go netip rejects "010.0.0.1").
// The regex itself enforces the range, so a manual "≤255" check isn't needed.
const OCTET = "(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])"
const IPV4_RE = new RegExp(`^${OCTET}\\.${OCTET}\\.${OCTET}\\.${OCTET}$`)
const CIDR_RE = new RegExp(`^${OCTET}\\.${OCTET}\\.${OCTET}\\.${OCTET}\\/(\\d{1,2})$`)

export function isValidIPv4(v: string): boolean {
  return IPV4_RE.test(v)
}

export function isValidCIDR(v: string): boolean {
  const m = CIDR_RE.exec(v)
  if (!m) return false
  return Number(m[5]) <= 32
}

// ── Form types ─────────────────────────────────────────────────────────────────

export type ExternalFormValues = { Enabled: boolean; Port: number; Protocol: Protocol }
export type DeviceFormValues = Omit<NormalizedDevice, "External"> & { External: ExternalFormValues }
export type TopologyFormValues = Omit<NormalizedTopology, "Devices"> & { Devices: DeviceFormValues[] }
export type PlaceholderFormValues = {
  Kind: PlaceholderKind
  IPReference: string
  Octets1to3: string
  LastOctet: number
  ShowMask: boolean
  DeviceName: string
}
export type TaskFormValues = Omit<NormalizedTask, "Placeholders"> & { Placeholders: PlaceholderFormValues[] }
export type VariantFormValues = Omit<NormalizedVariant, "Topology" | "Tasks"> & {
  Topology: TopologyFormValues
  Tasks: TaskFormValues[]
}
export type DraftFormValues = {
  AdminNote: string
  RegenerateFlagsOnPublish: boolean
  Variants: VariantFormValues[]
}

// ── identity ───────────────────────────────────────────────────────────────────

export const identitySchema = z.object({
  Name: z.string().trim().min(3, t("admin.ex.val.name")).max(50, t("admin.ex.val.name")),
  Description: z.string().max(2000, t("admin.ex.val.description")),
  Tags: z
    .array(z.string().trim().min(1, t("admin.ex.val.tag")).max(30, t("admin.ex.val.tag")))
    .max(20, t("admin.ex.val.tags")),
})
export type IdentityFormValues = z.infer<typeof identitySchema>

// ── draft snapshot ───────────────────────────────────────────────────────────────

const networkSchema = z.object({ Enabled: z.boolean(), DHCP: z.boolean() })

const ipConfigSchema = z
  .object({
    Type: z.enum(["static", "dhcp", "none"]),
    Addresses: z.array(z.string()),
    Gateway: z.string(),
  })
  .superRefine((ip, ctx) => {
    if (ip.Type === "static") {
      if (ip.Addresses.length === 0) {
        ctx.addIssue({ code: "custom", path: ["Addresses"], message: t("admin.ex.val.addressesRequired") })
      }
      ip.Addresses.forEach((a, i) => {
        if (!isValidCIDR(a)) {
          ctx.addIssue({ code: "custom", path: ["Addresses", i], message: t("admin.ex.val.cidr") })
        }
      })
      if (ip.Gateway !== "" && !isValidIPv4(ip.Gateway)) {
        ctx.addIssue({ code: "custom", path: ["Gateway"], message: t("admin.ex.val.gateway") })
      }
    } else {
      if (ip.Addresses.length > 0) {
        ctx.addIssue({ code: "custom", path: ["Addresses"], message: t("admin.ex.val.addressesForbidden") })
      }
      if (ip.Gateway !== "") {
        ctx.addIssue({ code: "custom", path: ["Gateway"], message: t("admin.ex.val.gatewayStaticOnly") })
      }
    }
  })

const interfaceSchema = z.object({
  Name: z.string().min(1, t("admin.ex.val.ifaceName")),
  MAC: z.string().refine((v) => v === "" || MAC_RE.test(v), t("admin.ex.val.mac")),
  IP: ipConfigSchema,
})

const envVarSchema = z.object({
  Name: z.string().min(1, t("admin.ex.val.envName")),
  Value: z.string(),
  Secret: z.boolean(),
  HasValue: z.boolean(),
})

const externalSchema = z
  .object({
    Enabled: z.boolean(),
    Port: z.number().int(t("admin.ex.val.port")),
    Protocol: z.enum(["http", "https"]),
  })
  .superRefine((ext, ctx) => {
    if (ext.Enabled && (ext.Port < 1 || ext.Port > 65535)) {
      ctx.addIssue({ code: "custom", path: ["Port"], message: t("admin.ex.val.port") })
    }
  })

const deviceSchema = z
  .object({
    ID: z.string(),
    Name: z.string().regex(DNS_LABEL_RE, t("admin.ex.val.deviceName")),
    Type: z.enum(["container", "vm", "unmanaged-switch", "hub"]),
    Image: z.string(),
    Interfaces: z.array(interfaceSchema),
    EnvVars: z.array(envVarSchema),
    External: externalSchema,
  })
  .superRefine((d, ctx) => {
    const forwarding = d.Type === "unmanaged-switch" || d.Type === "hub"
    if (forwarding && (d.Image !== "" || d.Interfaces.length > 0 || d.EnvVars.length > 0 || d.External.Enabled)) {
      ctx.addIssue({ code: "custom", path: ["Type"], message: t("admin.ex.val.forwardingBare") })
    }
  })

const endpointSchema = z
  .object({
    Kind: z.enum(["device", "vpn", "internet"]),
    DeviceID: z.string(),
    Interface: z.string(),
  })
  .superRefine((ep, ctx) => {
    if (ep.Kind === "device") {
      if (ep.DeviceID === "") {
        ctx.addIssue({ code: "custom", path: ["DeviceID"], message: t("admin.ex.val.endpointDevice") })
      }
    } else {
      // vpn/internet endpoints don't reference a device: DeviceID and Interface must be
      // empty (backend — ErrConnectionEndpointsInvalid, topology.go).
      if (ep.DeviceID !== "" || ep.Interface !== "") {
        ctx.addIssue({ code: "custom", path: ["DeviceID"], message: t("admin.ex.val.endpointGateway") })
      }
    }
  })

const connectionSchema = z.object({
  Endpoints: z.array(endpointSchema).length(2, t("admin.ex.val.connectionArity")),
})

const topologySchema = z
  .object({
    VPN: networkSchema,
    Internet: networkSchema,
    Devices: z.array(deviceSchema),
    Connections: z.array(connectionSchema),
  })
  .superRefine((topology, ctx) => {
    // Endpoint resolution (mirrors backend ErrEndpointUnresolved): a device endpoint
    // must reference a device that still exists, and — for non-forwarding devices
    // (container/vm) — an interface that still exists on it. Switch/hub devices carry
    // no interfaces, so their endpoints leave Interface empty by design. This check
    // lives at the topology level because it needs both Devices and Connections in
    // scope; endpointSchema alone can't see the device list.
    topology.Connections.forEach((connection, ci) => {
      connection.Endpoints.forEach((ep, side) => {
        if (ep.Kind !== "device") return
        const device = topology.Devices.find((d) => d.ID === ep.DeviceID)
        if (!device) {
          ctx.addIssue({
            code: "custom",
            path: ["Connections", ci, "Endpoints", side, "DeviceID"],
            message: t("admin.ex.val.endpointUnresolved"),
          })
          return
        }
        const forwarding = device.Type === "unmanaged-switch" || device.Type === "hub"
        if (!forwarding && !device.Interfaces.some((iface) => iface.Name === ep.Interface)) {
          ctx.addIssue({
            code: "custom",
            path: ["Connections", ci, "Endpoints", side, "Interface"],
            message: t("admin.ex.val.endpointUnresolved"),
          })
        }
      })
    })
  })

const placeholderSchema = z
  .object({
    Kind: z.enum(["vpn.subnet", "internet.subnet", "ip", "external.link"]),
    IPReference: z.string(),
    Octets1to3: z.string(),
    LastOctet: z.number().int().min(0, t("admin.ex.val.lastOctet")).max(255, t("admin.ex.val.lastOctet")),
    ShowMask: z.boolean(),
    DeviceName: z.string(),
  })
  .superRefine((p, ctx) => {
    if (p.Kind === "ip" && !["vpn", "internet", "static"].includes(p.IPReference)) {
      ctx.addIssue({ code: "custom", path: ["IPReference"], message: t("admin.ex.val.placeholderIPRef") })
    }
    if (p.Kind === "external.link" && p.DeviceName === "") {
      ctx.addIssue({ code: "custom", path: ["DeviceName"], message: t("admin.ex.val.placeholderDevice") })
    }
  })

const taskSchema = z.object({
  ID: z.string(),
  Name: z.string().trim().min(3, t("admin.ex.val.taskName")).max(50, t("admin.ex.val.taskName")),
  Description: z.custom<Record<string, unknown> | null>(
    (v) => v === null || (typeof v === "object" && v !== null && !Array.isArray(v)),
  ),
  Difficulty: z.enum(["trivial", "easy", "medium", "hard", "insane"]),
  Flag: z.array(z.string().refine((v) => v.trim() !== "", t("admin.ex.val.flagBlank"))),
  LinkedDeviceID: z.string(),
  DeviceFlagVar: z.string(),
  Attachments: z.array(z.object({ FileID: z.string(), Name: z.string() })),
  Placeholders: z.array(placeholderSchema),
})

const variantSchema = z.object({
  ID: z.string(),
  Index: z.number().int(),
  Tasks: z.array(taskSchema).min(1, t("admin.ex.val.taskRequired")),
  Topology: topologySchema,
})

export const draftSchema = z
  .object({
    AdminNote: z.string(),
    RegenerateFlagsOnPublish: z.boolean(),
    Variants: z.array(variantSchema).min(1, t("admin.ex.val.variantRequired")),
  })
  .superRefine((draft, ctx) => {
    // Domain invariant ErrTaskCountMismatch: every variant has the same number of tasks.
    const expected = draft.Variants[0]?.Tasks.length ?? 0
    draft.Variants.forEach((variant, i) => {
      if (variant.Tasks.length !== expected) {
        ctx.addIssue({
          code: "custom",
          path: ["Variants", i, "Tasks"],
          message: t("admin.ex.val.taskCountMismatch"),
        })
      }
    })
  })

// ── Empty-value factories ────────────────────────────────────────────────────────

export function emptyTask(): TaskFormValues {
  return {
    ID: "",
    Name: "",
    Description: null,
    Difficulty: "easy",
    Flag: [],
    LinkedDeviceID: "",
    DeviceFlagVar: "",
    Attachments: [],
    Placeholders: [],
  }
}

export function emptyInterface(): NormalizedInterface {
  return { Name: "eth0", MAC: "", IP: { Type: "dhcp", Addresses: [], Gateway: "" } }
}

export function emptyDevice(): DeviceFormValues {
  return {
    ID: crypto.randomUUID(), // client-side ID: Connections/LinkedDeviceID can reference it immediately
    Name: "",
    Type: "container",
    Image: "",
    Interfaces: [emptyInterface()],
    EnvVars: [],
    External: { Enabled: false, Port: 80, Protocol: "http" },
  }
}

export function emptyPlaceholder(): PlaceholderFormValues {
  return { Kind: "ip", IPReference: "vpn", Octets1to3: "", LastOctet: 0, ShowMask: false, DeviceName: "" }
}

export function emptyVariant(index: number): VariantFormValues {
  return {
    ID: "",
    Index: index,
    Tasks: [emptyTask()],
    Topology: {
      VPN: { Enabled: false, DHCP: true },
      Internet: { Enabled: false, DHCP: true },
      Devices: [],
      Connections: [],
    },
  }
}

export function emptyDraft(): DraftFormValues {
  return { AdminNote: "", RegenerateFlagsOnPublish: false, Variants: [emptyVariant(1)] }
}

// ── Serialization: version → form → saveDraftRequest ────────────────────────────

/** Version (or null — no draft yet) → editor form values. */
export function toDraftFormValues(version: Version | null): DraftFormValues {
  if (!version) return emptyDraft()
  return {
    AdminNote: version.AdminNote,
    RegenerateFlagsOnPublish: version.RegenerateFlagsOnPublish,
    Variants: version.Variants.map((v) => ({
      ID: v.ID,
      Index: v.Index,
      Tasks: v.Tasks.map((task) => ({
        ...task,
        Placeholders: task.Placeholders.map((p) => ({
          Kind: p.Kind,
          IPReference: p.IPReference ?? "",
          Octets1to3: p.Octets1to3 ?? "",
          LastOctet: p.LastOctet ?? 0,
          ShowMask: p.ShowMask ?? false,
          DeviceName: p.DeviceName ?? "",
        })),
      })),
      Topology: {
        VPN: v.Topology.VPN,
        Internet: v.Topology.Internet,
        Devices: v.Topology.Devices.map((d) => ({
          ...d,
          External: d.External
            ? { Enabled: true, Port: d.External.Port, Protocol: d.External.Protocol }
            : { Enabled: false, Port: 80, Protocol: "http" as Protocol },
        })),
        Connections: v.Topology.Connections,
      },
    })),
  }
}

function placeholderToDTO(p: PlaceholderFormValues): PlaceholderDTO {
  switch (p.Kind) {
    case "ip":
      return {
        Kind: p.Kind,
        IPReference: p.IPReference,
        LastOctet: p.LastOctet,
        ShowMask: p.ShowMask,
        ...(p.IPReference === "static" ? { Octets1to3: p.Octets1to3 } : {}),
      }
    case "external.link":
      return { Kind: p.Kind, DeviceName: p.DeviceName }
    default:
      // vpn.subnet / internet.subnet — Kind only
      return { Kind: p.Kind }
  }
}

function taskToDTO(task: TaskFormValues): TaskDTO {
  return {
    ...(task.ID ? { ID: task.ID } : {}),
    Name: task.Name,
    ...(task.Description ? { Description: task.Description } : {}),
    Difficulty: task.Difficulty,
    Flag: task.Flag,
    ...(task.LinkedDeviceID ? { LinkedDeviceID: task.LinkedDeviceID, DeviceFlagVar: task.DeviceFlagVar } : {}),
    Attachments: task.Attachments,
    Placeholders: task.Placeholders.map(placeholderToDTO),
  }
}

function interfaceToDTO(iface: NormalizedInterface): InterfaceDTO {
  return {
    Name: iface.Name,
    ...(iface.MAC ? { MAC: iface.MAC } : {}),
    IP: {
      Type: iface.IP.Type,
      ...(iface.IP.Type === "static"
        ? { Addresses: iface.IP.Addresses, ...(iface.IP.Gateway ? { Gateway: iface.IP.Gateway } : {}) }
        : {}),
    },
  }
}

function deviceToDTO(d: DeviceFormValues): DeviceDTO {
  // The device ID ALWAYS goes out (client-side uuid for new devices): Connections
  // and LinkedDeviceID reference it.
  const base: DeviceDTO = { ID: d.ID, Name: d.Name, Type: d.Type }
  if (d.Type === "unmanaged-switch" || d.Type === "hub") return base // switch/hub is "bare"
  return {
    ...base,
    ...(d.Image ? { Image: d.Image } : {}),
    Interfaces: d.Interfaces.map(interfaceToDTO),
    EnvVars: d.EnvVars.map((ev) => ({ Name: ev.Name, Value: ev.Value, Secret: ev.Secret })),
    ...(d.External.Enabled ? { External: { Port: d.External.Port, Protocol: d.External.Protocol } } : {}),
  }
}

function topologyToDTO(topology: TopologyFormValues): TopologyDTO {
  const connections: ConnectionDTO[] = topology.Connections.map((c) => ({
    Endpoints: c.Endpoints.map((ep) =>
      ep.Kind === "device"
        ? { Kind: ep.Kind, DeviceID: ep.DeviceID, ...(ep.Interface ? { Interface: ep.Interface } : {}) }
        : { Kind: ep.Kind },
    ),
  }))
  return {
    VPN: topology.VPN,
    Internet: topology.Internet,
    Devices: topology.Devices.map(deviceToDTO),
    Connections: connections,
    // VisualRender is not written (reserved for the canvas).
  }
}

/** Form values → PUT /:id/draft (1:1, Index is renumbered by position). */
export function toSaveDraftInput(values: DraftFormValues): SaveDraftInput {
  const variants: VariantDTO[] = values.Variants.map((v, i) => ({
    ...(v.ID ? { ID: v.ID } : {}),
    Index: i + 1,
    Tasks: v.Tasks.map(taskToDTO),
    Topology: topologyToDTO(v.Topology),
  }))
  return {
    AdminNote: values.AdminNote,
    RegenerateFlagsOnPublish: values.RegenerateFlagsOnPublish,
    Variants: variants,
  }
}
