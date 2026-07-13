/**
 * exerciseSchemas.ts — zod-зеркало доменной валидации exercise-версий
 * (внутри internal/model/exercise бэкенда) + form-типы и фабрики редактора.
 *
 * Валидация здесь ловит ошибки ДО запроса; сервер всё равно главный.
 * Схемы описывают DraftFormValues (форма 1:1 с SaveDraftInput; отличие одно:
 * External в форме — {Enabled, Port, Protocol} вместо nullable-объекта).
 */
import { z } from "zod"
import { t } from "@/i18n/t"
import type {
  NormalizedDevice,
  NormalizedInterface,
  NormalizedTask,
  NormalizedTopology,
  NormalizedVariant,
  PlaceholderKind,
  Protocol,
} from "@/api/exercises/versions"

// ── Регексы и парсеры (зеркало домена) ─────────────────────────────────────────

export const DNS_LABEL_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/
export const MAC_RE = /^[0-9A-Fa-f]{2}([:-][0-9A-Fa-f]{2}){5}$/
const CIDR_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/
const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

export function isValidIPv4(v: string): boolean {
  const m = IPV4_RE.exec(v)
  return m !== null && m.slice(1).every((o) => Number(o) <= 255)
}

export function isValidCIDR(v: string): boolean {
  const m = CIDR_RE.exec(v)
  if (!m) return false
  if (m.slice(1, 5).some((o) => Number(o) > 255)) return false
  return Number(m[5]) <= 32
}

// ── Form-типы ──────────────────────────────────────────────────────────────────

export type ExternalFormValues = { Enabled: boolean; Port: number; Protocol: Protocol }
export type DeviceFormValues = Omit<NormalizedDevice, "External"> & { External: ExternalFormValues }
export type TopologyFormValues = Omit<NormalizedTopology, "Devices"> & { Devices: DeviceFormValues[] }
export type VariantFormValues = Omit<NormalizedVariant, "Topology"> & { Topology: TopologyFormValues }
export type TaskFormValues = NormalizedTask
export type PlaceholderFormValues = {
  Kind: PlaceholderKind
  IPReference: string
  Octets1to3: string
  LastOctet: number
  ShowMask: boolean
  DeviceName: string
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

// ── снапшот драфта ─────────────────────────────────────────────────────────────

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
    if (ep.Kind === "device" && ep.DeviceID === "") {
      ctx.addIssue({ code: "custom", path: ["DeviceID"], message: t("admin.ex.val.endpointDevice") })
    }
  })

const connectionSchema = z.object({
  Endpoints: z.array(endpointSchema).length(2, t("admin.ex.val.connectionArity")),
})

const topologySchema = z.object({
  VPN: networkSchema,
  Internet: networkSchema,
  Devices: z.array(deviceSchema),
  Connections: z.array(connectionSchema),
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
    // Доменный инвариант ErrTaskCountMismatch: у всех вариантов одинаковое число задач.
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

// ── Фабрики пустых значений ────────────────────────────────────────────────────

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
    ID: crypto.randomUUID(), // клиентский ID: на него сразу могут ссылаться Connections/LinkedDeviceID
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
