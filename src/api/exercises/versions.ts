/**
 * versions.ts — версии/lifecycle exercise и типы снапшота драфта.
 *
 * Роуты: GET /api/exercises/:id/versions[/:versionID],
 *   POST :id/versions/:versionID/rollback, PUT/DELETE :id/draft, POST :id/publish.
 *
 * DTO-типы транскрибируют exercise.saveDraftRequest/versionResponse бэкенда 1:1
 * (PascalCase, omitempty-поля — optional). Normalized* — read-модель для формы:
 * все optional-поля заполнены конкретными дефолтами ("", [], null).
 *
 * Ключевые контракты:
 *  - variant.ID пустой у нового варианта (бэк генерит UUIDv7); СУЩЕСТВУЮЩИЕ ID
 *    обязаны уходить обратно — ключ секретов = (variant ID, device Name, env Name);
 *  - device.ID для НОВЫХ устройств генерит клиент (crypto.randomUUID()), иначе
 *    Connections/LinkedDeviceID не смогут сослаться на устройство до сохранения;
 *  - Flag: [] → случайный при развёртывании; 1 значение → фиксированный;
 *    несколько → выбор при развёртывании;
 *  - EnvVar.Value write-only: в ответах пуст, HasValue=true если значение
 *    хранится; пустой Value при сохранении = «оставить сохранённое»;
 *  - VisualRender не читаем и не пишем.
 */
import { apiGet, apiPost, apiPut, apiDelete } from "@/api/client"

const BASE = "/api/exercises"

export type VersionStatus = "draft" | "published" | "unpublished"
export type Difficulty = "trivial" | "easy" | "medium" | "hard" | "insane"
export type DeviceType = "container" | "vm" | "unmanaged-switch" | "hub"
export type IPType = "static" | "dhcp" | "none"
export type EndpointKind = "device" | "vpn" | "internet"
export type Protocol = "http" | "https"
export type PlaceholderKind = "vpn.subnet" | "internet.subnet" | "ip" | "external.link"

/** Lexical JSON (json.RawMessage на бэке) — непрозрачный объект. */
export type LexicalDoc = Record<string, unknown>

export type AttachmentDTO = { FileID: string; Name: string }

export type PlaceholderDTO = {
  Kind: PlaceholderKind
  IPReference?: string // "vpn" | "internet" | "static" (только Kind === "ip")
  Octets1to3?: string // только IPReference === "static"
  LastOctet?: number // 0..255
  ShowMask?: boolean
  DeviceName?: string // только Kind === "external.link"
}

export type EnvVarDTO = {
  Name: string
  Value?: string
  Secret: boolean
  HasValue?: boolean // response-only
}

export type ExternalDTO = { Port: number; Protocol: Protocol }

export type IPConfigDTO = {
  Type: IPType
  Addresses?: string[] // CIDR, только static
  Gateway?: string // только static
}

export type InterfaceDTO = { Name: string; MAC?: string; IP: IPConfigDTO }

export type DeviceDTO = {
  ID?: string
  Name: string // DNS label
  Type: DeviceType
  Image?: string
  Interfaces?: InterfaceDTO[]
  EnvVars?: EnvVarDTO[]
  External?: ExternalDTO
}

export type EndpointDTO = { Kind: EndpointKind; DeviceID?: string; Interface?: string }
export type ConnectionDTO = { Endpoints: EndpointDTO[] } // ровно 2
export type NetworkDTO = { Enabled: boolean; DHCP: boolean }

export type TopologyDTO = {
  VPN: NetworkDTO
  Internet: NetworkDTO
  Devices?: DeviceDTO[]
  Connections?: ConnectionDTO[]
  VisualRender?: Record<string, unknown> // зарезервирован, не используем
}

export type TaskDTO = {
  ID?: string
  Name: string
  Description?: LexicalDoc | null
  Difficulty: Difficulty
  Flag?: string[]
  LinkedDeviceID?: string
  DeviceFlagVar?: string
  Attachments?: AttachmentDTO[]
  Placeholders?: PlaceholderDTO[]
}

export type VariantDTO = {
  ID?: string
  Index: number // декоративный номер; идентичность = ID
  Tasks: TaskDTO[]
  Topology: TopologyDTO
}

export type SaveDraftInput = {
  AdminNote: string
  RegenerateFlagsOnPublish: boolean
  Variants: VariantDTO[]
}

export type VersionListItem = {
  ID: string
  Status: VersionStatus
  AdminNote: string
  VariantCount: number
  CreatedAt: string
  CreatedBy: string | null
  PublishedAt: string | null
}

// ── Normalized read-модель (все optional заполнены) ────────────────────────────

export type NormalizedTask = {
  ID: string
  Name: string
  Description: LexicalDoc | null
  Difficulty: Difficulty
  Flag: string[]
  LinkedDeviceID: string
  DeviceFlagVar: string
  Attachments: AttachmentDTO[]
  Placeholders: PlaceholderDTO[]
}

export type NormalizedEnvVar = { Name: string; Value: string; Secret: boolean; HasValue: boolean }

export type NormalizedInterface = {
  Name: string
  MAC: string
  IP: { Type: IPType; Addresses: string[]; Gateway: string }
}

export type NormalizedDevice = {
  ID: string
  Name: string
  Type: DeviceType
  Image: string
  Interfaces: NormalizedInterface[]
  EnvVars: NormalizedEnvVar[]
  External: ExternalDTO | null
}

export type NormalizedEndpoint = { Kind: EndpointKind; DeviceID: string; Interface: string }
export type NormalizedConnection = { Endpoints: NormalizedEndpoint[] }

export type NormalizedTopology = {
  VPN: NetworkDTO
  Internet: NetworkDTO
  Devices: NormalizedDevice[]
  Connections: NormalizedConnection[]
}

export type NormalizedVariant = {
  ID: string
  Index: number
  Tasks: NormalizedTask[]
  Topology: NormalizedTopology
}

export type Version = {
  ID: string
  ExerciseID: string
  Status: VersionStatus
  AdminNote: string
  RegenerateFlagsOnPublish: boolean
  Variants: NormalizedVariant[]
  CreatedAt: string
  CreatedBy: string | null
  PublishedAt: string | null
}

// ── Normalize ──────────────────────────────────────────────────────────────────

function normalizeTask(raw: TaskDTO): NormalizedTask {
  return {
    ID: raw.ID ?? "",
    Name: raw.Name,
    Description: raw.Description ?? null,
    Difficulty: raw.Difficulty,
    Flag: raw.Flag ?? [],
    LinkedDeviceID: raw.LinkedDeviceID ?? "",
    DeviceFlagVar: raw.DeviceFlagVar ?? "",
    Attachments: raw.Attachments ?? [],
    Placeholders: raw.Placeholders ?? [],
  }
}

function normalizeInterface(raw: InterfaceDTO): NormalizedInterface {
  return {
    Name: raw.Name,
    MAC: raw.MAC ?? "",
    IP: {
      Type: raw.IP?.Type ?? "none",
      Addresses: raw.IP?.Addresses ?? [],
      Gateway: raw.IP?.Gateway ?? "",
    },
  }
}

function normalizeDevice(raw: DeviceDTO): NormalizedDevice {
  return {
    ID: raw.ID ?? "",
    Name: raw.Name,
    Type: raw.Type,
    Image: raw.Image ?? "",
    Interfaces: (raw.Interfaces ?? []).map(normalizeInterface),
    EnvVars: (raw.EnvVars ?? []).map((ev) => ({
      Name: ev.Name,
      Value: ev.Value ?? "",
      Secret: ev.Secret,
      HasValue: ev.HasValue ?? false,
    })),
    External: raw.External ?? null,
  }
}

function normalizeTopology(raw: TopologyDTO | null | undefined): NormalizedTopology {
  return {
    VPN: raw?.VPN ?? { Enabled: false, DHCP: false },
    Internet: raw?.Internet ?? { Enabled: false, DHCP: false },
    Devices: (raw?.Devices ?? []).map(normalizeDevice),
    Connections: (raw?.Connections ?? []).map((c) => ({
      Endpoints: (c.Endpoints ?? []).map((ep) => ({
        Kind: ep.Kind,
        DeviceID: ep.DeviceID ?? "",
        Interface: ep.Interface ?? "",
      })),
    })),
  }
}

export function normalizeVariant(raw: VariantDTO): NormalizedVariant {
  return {
    ID: raw.ID ?? "",
    Index: raw.Index,
    Tasks: (raw.Tasks ?? []).map(normalizeTask),
    Topology: normalizeTopology(raw.Topology),
  }
}

type RawVersion = Omit<Version, "Variants"> & { Variants: VariantDTO[] | null }

function normalizeVersion(raw: RawVersion): Version {
  return { ...raw, Variants: (raw.Variants ?? []).map(normalizeVariant) }
}

// ── API ────────────────────────────────────────────────────────────────────────

/** GET /api/exercises/:id/versions */
export async function listVersions(exerciseId: string): Promise<VersionListItem[]> {
  const raw = await apiGet<VersionListItem[] | null>(`${BASE}/${exerciseId}/versions`)
  return raw ?? []
}

/** GET /api/exercises/:id/versions/:versionID */
export async function getVersion(exerciseId: string, versionId: string): Promise<Version> {
  const raw = await apiGet<RawVersion>(`${BASE}/${exerciseId}/versions/${versionId}`)
  return normalizeVersion(raw)
}

/** PUT /api/exercises/:id/draft — полный снапшот */
export async function saveDraft(exerciseId: string, input: SaveDraftInput): Promise<Version> {
  const raw = await apiPut<RawVersion>(`${BASE}/${exerciseId}/draft`, input)
  return normalizeVersion(raw)
}

/** POST /api/exercises/:id/publish */
export async function publishDraft(exerciseId: string): Promise<Version> {
  const raw = await apiPost<RawVersion>(`${BASE}/${exerciseId}/publish`, {})
  return normalizeVersion(raw)
}

/** DELETE /api/exercises/:id/draft */
export function discardDraft(exerciseId: string): Promise<void> {
  return apiDelete<void>(`${BASE}/${exerciseId}/draft`)
}

/** POST /api/exercises/:id/versions/:versionID/rollback */
export async function rollbackToVersion(exerciseId: string, versionId: string): Promise<Version> {
  const raw = await apiPost<RawVersion>(`${BASE}/${exerciseId}/versions/${versionId}/rollback`, {})
  return normalizeVersion(raw)
}
