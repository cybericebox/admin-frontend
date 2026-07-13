# Admin Exercise Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Полный админский раздел «Завдання» (exercise catalog): каталог с поиском/тегами, карточка задания (identity + версии + lifecycle publish/discard/rollback), редактор чернетки (варианты → задачи + топология + секреты + файлы) с read-only режимом версий.

**Architecture:** Static-export SPA (Next.js App Router, `output: 'export'`), роутинг через `?id=`/`?versionId=` query-параметры. Три страницы (`/exercises`, `/exercises/detail`, `/exercises/draft`) + типизированные API-клиенты (`src/api/exercises/*`) поверх envelope-клиента `client.ts`. Редактор — ОДИН `useForm<DraftFormValues>` на весь снапшот `SaveDraftInput`, вложенность через `useFieldArray`, Lexical-поля как controlled-исключения, рядом read-only SVG `TopologyDiagram`, пересчитываемый из значений формы (`useWatch`).

**Tech Stack:** Next.js 16 App Router (static export), React 19, Tailwind 4, shadcn new-york, react-hook-form 7 + zod 4 (`@hookform/resolvers`), Lexical 0.44 (`RichTextEditor`), vitest 2 + Testing Library, i18n через плоские ключи в `messages/en.json` + `messages/uk.json`.

## Global Constraints

- Ветка: коммитить в ТЕКУЩУЮ ветку `feature/base-redesign`; веток/worktree не создавать.
- В индексе уже лежат ЧУЖИЕ staged-изменения (`Dockerfile`, `deploy/Dockerfile`, `deploy/entrypoint.sh`, перенос `docker-entrypoint.sh`/`nginx.conf` в `deploy/`) и есть чужие modified-файлы (`src/api/notifications/emailTemplates.test.ts`, `src/app/notifications/templates/email/page.test.tsx`, `src/components/notifications/LogsTab.test.tsx`, `src/components/notifications/editor/BlockEditor.tsx`). Их НЕ трогать и НЕ коммитить: каждый коммит — ТОЛЬКО `git add <свои пути>` затем `git commit -m "..." -- <те же пути>` (pathspec у commit обязателен — голый `git commit` заберёт чужой индекс). После каждого коммита проверять `git show --stat HEAD`.
- Роутинг static-export-safe: только `?id=`/`?versionId=` query-параметры, НИКАКИХ `[id]`-сегментов; `useSearchParams` всегда внутри `<Suspense>`.
- Все UI-строки — украинские; КАЖДЫЙ новый ключ добавляется в ОБА каталога: `messages/en.json` (английский референс) и `messages/uk.json` (активный язык).
- JSON к бэкенду — PascalCase; envelope `{Status:{Code,Message},Data}` разворачивает `src/api/client.ts` (`apiGet/apiPost/apiPut/apiPatch/apiDelete`); `Status.Code` — целый FullCode.
- RBAC в UI: `can("exercises.read")` — навигация/страницы; `can("exercises.write")` — создание/редактирование/загрузка файлов; `can("exercises.delete")` — удаление; `can("exercises.publish")` — publish/discard/rollback (зеркало гейтов бэкенда).
- Верификация КАЖДОЙ задачи: `npm run lint && npm run test`; в финальной задаче дополнительно `npm run build`.
- Пагинация каталога: query-параметр **`pageSize`** (бэкенд биндит `form:"pageSize"`; слово «limit» из спеки §4 — это он и есть), `cursor` — uuid последней строки.
- Тип устройства: `container | vm | unmanaged-switch | hub` — доменная константа бэкенда `unmanaged-switch` (в спеке §4 сокращённо «switch»).
- Новые устройства получают КЛИЕНТСКИЙ `crypto.randomUUID()` в поле `ID` — иначе `Connections` и `LinkedDeviceID` не смогут ссылаться на них до сохранения (бэкенд сохраняет присланные ID, генерит только отсутствующие).
- Секреты: `Value` write-only (в ответах пуст, `HasValue=true` если значение хранится; пустой `Value` при сохранении = «оставить сохранённое»); ключ секрета на бэке — (ID варианта, имя устройства, имя переменной), поэтому форма ОБЯЗАНА сохранять и отправлять обратно ID вариантов.
- `VisualRender` не читаем и не пишем (зарезервирован под будущий канвас).

---

### Task 1: API-клиенты + типы + normalize + словарь ошибок + тесты

**Files:**
- Create: `src/api/exercises/catalog.ts`
- Create: `src/api/exercises/catalog.test.ts`
- Create: `src/api/exercises/versions.ts`
- Create: `src/api/exercises/versions.test.ts`
- Create: `src/api/exercises/files.ts`
- Create: `src/api/exercises/files.test.ts`
- Create: `src/lib/exerciseErrors.ts`
- Create: `src/lib/exerciseErrors.test.ts`
- Modify: `messages/en.json` (ключи `admin.ex.err.*`)
- Modify: `messages/uk.json` (те же ключи)

Словарь ошибок создаётся здесь (а не в Task 12), потому что карточка (Task 4–5) и редактор (Task 6+) уже используют `exerciseErrorMessage`; Task 12 остаётся интеграцией/полировкой. FullCode = `informCode*10000 + objectCode*100 + detailCode`; exercise objectCode = 9, media = 10; inform: 2=InvalidData, 3=NotFound, 4=Exists, 7=Conflict.

**Interfaces:**
- Consumes: `apiGet/apiPost/apiPatch/apiPut/apiDelete`, `ApiError` из `@/api/client`; `t` из `@/i18n/t`.
- Produces (контракт для ВСЕХ последующих задач):
  - `catalog.ts`: `ExerciseListItem`, `ExercisesListResponse`, `Exercise`, `ExerciseIdentityInput`, `ExercisesFilter`; `listExercises(filter?: ExercisesFilter): Promise<ExercisesListResponse>`, `getExercise(id: string): Promise<Exercise>`, `createExercise(input: ExerciseIdentityInput): Promise<Exercise>`, `updateExercise(id: string, input: ExerciseIdentityInput): Promise<Exercise>`, `deleteExercise(id: string): Promise<void>`.
  - `versions.ts`: enums `VersionStatus/Difficulty/DeviceType/IPType/EndpointKind/Protocol/PlaceholderKind`; типы `LexicalDoc`, `AttachmentDTO`, `PlaceholderDTO`, `EnvVarDTO`, `ExternalDTO`, `IPConfigDTO`, `InterfaceDTO`, `DeviceDTO`, `EndpointDTO`, `ConnectionDTO`, `NetworkDTO`, `TopologyDTO`, `TaskDTO`, `VariantDTO`, `SaveDraftInput`, `VersionListItem`, `Version`, `NormalizedTask/NormalizedEnvVar/NormalizedInterface/NormalizedDevice/NormalizedEndpoint/NormalizedConnection/NormalizedTopology/NormalizedVariant`; функции `listVersions(exerciseId: string): Promise<VersionListItem[]>`, `getVersion(exerciseId: string, versionId: string): Promise<Version>`, `saveDraft(exerciseId: string, input: SaveDraftInput): Promise<Version>`, `publishDraft(exerciseId: string): Promise<Version>`, `discardDraft(exerciseId: string): Promise<void>`, `rollbackToVersion(exerciseId: string, versionId: string): Promise<Version>`, `normalizeVariant(raw: VariantDTO): NormalizedVariant`.
  - `files.ts`: `UploadedFile = { FileID: string; Name: string; Size: number }`; `uploadExerciseFile(file: File): Promise<UploadedFile>`, `exerciseFileURL(fileId: string): string`.
  - `exerciseErrors.ts`: `exerciseErrorCode(e: unknown): number | null`, `exerciseErrorMessage(e: unknown): string`, константы `ERR_EXERCISE_EXISTS = 40903`, `ERR_EXERCISE_MODIFIED = 70904`, `ERR_NO_DRAFT = 70905`, `ERR_DRAFT_ALREADY_EXISTS = 70906`.

- [ ] **Step 1: Написать падающие тесты API-клиентов**

`src/api/exercises/catalog.test.ts`:

```ts
/**
 * catalog.test.ts — пути, query-параметры и normalize клиента каталога.
 * vi.mock('@/api/client') перехватывает все HTTP-вызовы.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/client')

import * as client from '@/api/client'
import {
  listExercises,
  getExercise,
  createExercise,
  updateExercise,
  deleteExercise,
} from './catalog'

const mockApiGet = vi.mocked(client.apiGet)
const mockApiPost = vi.mocked(client.apiPost)
const mockApiPatch = vi.mocked(client.apiPatch)
const mockApiDelete = vi.mocked(client.apiDelete)

const EX_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

const rawListItem = {
  ID: EX_ID,
  Name: 'SQLi basics',
  Description: 'Intro',
  Tags: ['web', 'sql'],
  HasDraft: true,
  HasPublished: false,
  CreatedAt: '2026-01-01T00:00:00Z',
  UpdatedAt: '2026-01-02T00:00:00Z',
}

const rawExercise = {
  ID: EX_ID,
  Name: 'SQLi basics',
  Description: 'Intro',
  Tags: ['web'],
  DraftVersionID: null,
  PublishedVersionID: null,
  CreatedAt: '2026-01-01T00:00:00Z',
  CreatedBy: null,
  UpdatedAt: '2026-01-02T00:00:00Z',
  UpdatedBy: null,
}

describe('listExercises', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls apiGet with the bare base path when no filter', async () => {
    mockApiGet.mockResolvedValueOnce({ Exercises: [], NextCursor: '', HasMore: false })
    await listExercises()
    expect(mockApiGet.mock.calls[0][0]).toBe('/api/exercises')
  })

  it('builds search, repeated tags, cursor and pageSize params', async () => {
    mockApiGet.mockResolvedValueOnce({ Exercises: [], NextCursor: '', HasMore: false })
    await listExercises({ search: 'sql', tags: ['web', 'crypto'], cursor: EX_ID, pageSize: 50 })
    const [path] = mockApiGet.mock.calls[0]
    expect(path).toBe(`/api/exercises?search=sql&tags=web&tags=crypto&cursor=${EX_ID}&pageSize=50`)
  })

  it('normalises null Exercises and null Tags', async () => {
    mockApiGet.mockResolvedValueOnce({ Exercises: null, NextCursor: '', HasMore: false })
    const empty = await listExercises()
    expect(empty.Exercises).toEqual([])

    mockApiGet.mockResolvedValueOnce({
      Exercises: [{ ...rawListItem, Tags: null }],
      NextCursor: '',
      HasMore: false,
    })
    const result = await listExercises()
    expect(result.Exercises[0].Tags).toEqual([])
  })
})

describe('getExercise', () => {
  beforeEach(() => vi.clearAllMocks())

  it('GETs /:id and normalises null Tags', async () => {
    mockApiGet.mockResolvedValueOnce({ ...rawExercise, Tags: null })
    const result = await getExercise(EX_ID)
    expect(mockApiGet.mock.calls[0][0]).toBe(`/api/exercises/${EX_ID}`)
    expect(result.Tags).toEqual([])
  })
})

describe('createExercise', () => {
  beforeEach(() => vi.clearAllMocks())

  it('POSTs the identity body to the base path', async () => {
    mockApiPost.mockResolvedValueOnce(rawExercise)
    await createExercise({ Name: 'SQLi basics', Description: 'Intro', Tags: ['web'] })
    expect(mockApiPost.mock.calls[0][0]).toBe('/api/exercises')
    expect(mockApiPost.mock.calls[0][1]).toEqual({ Name: 'SQLi basics', Description: 'Intro', Tags: ['web'] })
  })
})

describe('updateExercise', () => {
  beforeEach(() => vi.clearAllMocks())

  it('PATCHes /:id with the identity body', async () => {
    mockApiPatch.mockResolvedValueOnce(rawExercise)
    await updateExercise(EX_ID, { Name: 'New', Description: '', Tags: [] })
    expect(mockApiPatch.mock.calls[0][0]).toBe(`/api/exercises/${EX_ID}`)
    expect(mockApiPatch.mock.calls[0][1]).toEqual({ Name: 'New', Description: '', Tags: [] })
  })
})

describe('deleteExercise', () => {
  beforeEach(() => vi.clearAllMocks())

  it('DELETEs /:id', async () => {
    mockApiDelete.mockResolvedValueOnce(undefined)
    await deleteExercise(EX_ID)
    expect(mockApiDelete.mock.calls[0][0]).toBe(`/api/exercises/${EX_ID}`)
  })
})
```

`src/api/exercises/versions.test.ts`:

```ts
/**
 * versions.test.ts — пути lifecycle-роутов и normalize версии/варианта.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/client')

import * as client from '@/api/client'
import {
  listVersions,
  getVersion,
  saveDraft,
  publishDraft,
  discardDraft,
  rollbackToVersion,
  normalizeVariant,
  type VariantDTO,
} from './versions'

const mockApiGet = vi.mocked(client.apiGet)
const mockApiPost = vi.mocked(client.apiPost)
const mockApiPut = vi.mocked(client.apiPut)
const mockApiDelete = vi.mocked(client.apiDelete)

const EX_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const VER_ID = 'ffffffff-0000-1111-2222-333333333333'
const DEV_ID = '99999999-8888-7777-6666-555555555555'

const rawVersion = {
  ID: VER_ID,
  ExerciseID: EX_ID,
  Status: 'draft' as const,
  AdminNote: 'wip',
  RegenerateFlagsOnPublish: false,
  Variants: null,
  CreatedAt: '2026-01-01T00:00:00Z',
  CreatedBy: null,
  PublishedAt: null,
}

describe('versions API paths', () => {
  beforeEach(() => vi.clearAllMocks())

  it('listVersions GETs /:id/versions and normalises null to []', async () => {
    mockApiGet.mockResolvedValueOnce(null)
    const result = await listVersions(EX_ID)
    expect(mockApiGet.mock.calls[0][0]).toBe(`/api/exercises/${EX_ID}/versions`)
    expect(result).toEqual([])
  })

  it('getVersion GETs /:id/versions/:versionID', async () => {
    mockApiGet.mockResolvedValueOnce(rawVersion)
    const result = await getVersion(EX_ID, VER_ID)
    expect(mockApiGet.mock.calls[0][0]).toBe(`/api/exercises/${EX_ID}/versions/${VER_ID}`)
    expect(result.Variants).toEqual([])
  })

  it('saveDraft PUTs the snapshot to /:id/draft', async () => {
    mockApiPut.mockResolvedValueOnce(rawVersion)
    const input = { AdminNote: '', RegenerateFlagsOnPublish: false, Variants: [] }
    await saveDraft(EX_ID, input)
    expect(mockApiPut.mock.calls[0][0]).toBe(`/api/exercises/${EX_ID}/draft`)
    expect(mockApiPut.mock.calls[0][1]).toBe(input)
  })

  it('publishDraft POSTs to /:id/publish', async () => {
    mockApiPost.mockResolvedValueOnce(rawVersion)
    await publishDraft(EX_ID)
    expect(mockApiPost.mock.calls[0][0]).toBe(`/api/exercises/${EX_ID}/publish`)
  })

  it('discardDraft DELETEs /:id/draft', async () => {
    mockApiDelete.mockResolvedValueOnce(undefined)
    await discardDraft(EX_ID)
    expect(mockApiDelete.mock.calls[0][0]).toBe(`/api/exercises/${EX_ID}/draft`)
  })

  it('rollbackToVersion POSTs to /:id/versions/:versionID/rollback', async () => {
    mockApiPost.mockResolvedValueOnce(rawVersion)
    await rollbackToVersion(EX_ID, VER_ID)
    expect(mockApiPost.mock.calls[0][0]).toBe(`/api/exercises/${EX_ID}/versions/${VER_ID}/rollback`)
  })
})

describe('normalizeVariant', () => {
  it('fills every optional field with a concrete default', () => {
    const raw: VariantDTO = {
      Index: 1,
      Tasks: [{ Name: 'Find the flag', Difficulty: 'easy' }],
      Topology: {
        VPN: { Enabled: true, DHCP: true },
        Internet: { Enabled: false, DHCP: false },
        Devices: [{ ID: DEV_ID, Name: 'web', Type: 'container' }],
        Connections: [{ Endpoints: [{ Kind: 'vpn' }, { Kind: 'device', DeviceID: DEV_ID, Interface: 'eth0' }] }],
      },
    }
    const v = normalizeVariant(raw)
    expect(v.ID).toBe('')
    expect(v.Tasks[0]).toEqual({
      ID: '',
      Name: 'Find the flag',
      Description: null,
      Difficulty: 'easy',
      Flag: [],
      LinkedDeviceID: '',
      DeviceFlagVar: '',
      Attachments: [],
      Placeholders: [],
    })
    expect(v.Topology.Devices[0]).toEqual({
      ID: DEV_ID,
      Name: 'web',
      Type: 'container',
      Image: '',
      Interfaces: [],
      EnvVars: [],
      External: null,
    })
    expect(v.Topology.Connections[0].Endpoints[0]).toEqual({ Kind: 'vpn', DeviceID: '', Interface: '' })
    expect(v.Topology.Connections[0].Endpoints[1]).toEqual({ Kind: 'device', DeviceID: DEV_ID, Interface: 'eth0' })
  })

  it('normalises a secret env var (empty Value, HasValue=true)', () => {
    const raw: VariantDTO = {
      Index: 1,
      Tasks: [],
      Topology: {
        VPN: { Enabled: false, DHCP: false },
        Internet: { Enabled: false, DHCP: false },
        Devices: [{
          ID: DEV_ID, Name: 'db', Type: 'container',
          EnvVars: [{ Name: 'DB_PASS', Secret: true, HasValue: true }],
        }],
        Connections: [],
      },
    }
    const v = normalizeVariant(raw)
    expect(v.Topology.Devices[0].EnvVars[0]).toEqual({ Name: 'DB_PASS', Value: '', Secret: true, HasValue: true })
  })
})
```

`src/api/exercises/files.test.ts`:

```ts
/**
 * files.test.ts — multipart-загрузка мимо JSON-клиента + download URL.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ApiError } from '@/api/client'
import { uploadExerciseFile, exerciseFileURL } from './files'

const FILE_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('uploadExerciseFile', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('POSTs multipart FormData with the "file" field and unwraps the envelope', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      Status: { Code: 10000, Message: 'Success' },
      Data: { FileID: FILE_ID, Name: 'notes.pdf', Size: 123 },
    }))
    const file = new File(['hello'], 'notes.pdf', { type: 'application/pdf' })
    const result = await uploadExerciseFile(file)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/exercises/files')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('include')
    expect(init.body).toBeInstanceOf(FormData)
    expect((init.body as FormData).get('file')).toBe(file)
    // Content-Type НЕ задаётся вручную — boundary ставит браузер.
    expect(init.headers).toBeUndefined()
    expect(result).toEqual({ FileID: FILE_ID, Name: 'notes.pdf', Size: 123 })
  })

  it('throws ApiError with the envelope message on failure', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(400, {
      Status: { Code: 21002, Message: 'File exceeds the maximum upload size' },
    }))
    const file = new File(['x'], 'big.bin')
    await expect(uploadExerciseFile(file)).rejects.toSatisfy((e: unknown) => {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).status).toBe(400)
      expect((e as ApiError).message).toBe('File exceeds the maximum upload size')
      return true
    })
  })
})

describe('exerciseFileURL', () => {
  it('builds the cookie-authenticated download URL', () => {
    expect(exerciseFileURL(FILE_ID)).toBe(`/api/exercises/files/${FILE_ID}`)
  })
})
```

`src/lib/exerciseErrors.test.ts`:

```ts
/**
 * exerciseErrors.test.ts — словарь FullCode → i18n-ключ.
 * t мокается «ключ → ключ», чтобы проверять именно выбор ключа.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))

import { ApiError } from '@/api/client'
import {
  exerciseErrorCode,
  exerciseErrorMessage,
  ERR_EXERCISE_EXISTS,
  ERR_EXERCISE_MODIFIED,
  ERR_NO_DRAFT,
  ERR_DRAFT_ALREADY_EXISTS,
} from './exerciseErrors'

function apiError(status: number, code: number, message: string): ApiError {
  return new ApiError(status, { Status: { Code: code, Message: message } }, message)
}

describe('exerciseErrorCode', () => {
  it('extracts the FullCode from the envelope body', () => {
    expect(exerciseErrorCode(apiError(409, 70904, 'modified'))).toBe(70904)
  })
  it('returns null for non-ApiError values', () => {
    expect(exerciseErrorCode(new Error('boom'))).toBeNull()
  })
})

describe('exerciseErrorMessage', () => {
  it('maps known domain codes to i18n keys', () => {
    expect(exerciseErrorMessage(apiError(409, ERR_EXERCISE_MODIFIED, 'x'))).toBe('admin.ex.err.modified')
    expect(exerciseErrorMessage(apiError(409, ERR_EXERCISE_EXISTS, 'x'))).toBe('admin.ex.err.exists')
    expect(exerciseErrorMessage(apiError(409, ERR_NO_DRAFT, 'x'))).toBe('admin.ex.err.noDraft')
    expect(exerciseErrorMessage(apiError(409, ERR_DRAFT_ALREADY_EXISTS, 'x'))).toBe('admin.ex.err.draftExists')
    expect(exerciseErrorMessage(apiError(400, 20912, 'x'))).toBe('admin.ex.err.taskCountMismatch')
    expect(exerciseErrorMessage(apiError(400, 21002, 'x'))).toBe('admin.ex.err.fileTooLarge')
  })

  it('falls back to generic + backend Status.Message for unknown codes', () => {
    expect(exerciseErrorMessage(apiError(500, 42, 'weird backend fact')))
      .toBe('admin.ex.err.generic: weird backend fact')
  })

  it('falls back to plain generic for non-ApiError', () => {
    expect(exerciseErrorMessage(new TypeError('offline'))).toBe('admin.ex.err.generic')
  })
})
```

- [ ] **Step 2: Запустить тесты — убедиться, что падают**

Run: `npx vitest run src/api/exercises src/lib/exerciseErrors.test.ts`
Expected: FAIL — «Cannot find module './catalog'» (и аналогично для versions/files/exerciseErrors).

- [ ] **Step 3: Реализовать `src/api/exercises/catalog.ts`**

```ts
/**
 * catalog.ts — типизированный клиент каталога exercises.
 *
 * Роуты: GET/POST /api/exercises, GET/PATCH/DELETE /api/exercises/:id.
 * JSON PascalCase; envelope {Status,Data} разворачивает client.ts.
 * Пагинация: cursor + pageSize (бэкенд биндит form:"pageSize").
 */
import { apiGet, apiPost, apiPatch, apiDelete } from "@/api/client"

const BASE = "/api/exercises"

export type ExerciseListItem = {
  ID: string
  Name: string
  Description: string
  Tags: string[]
  HasDraft: boolean
  HasPublished: boolean
  CreatedAt: string
  UpdatedAt: string
}

export type ExercisesListResponse = {
  Exercises: ExerciseListItem[]
  NextCursor: string
  HasMore: boolean
}

export type Exercise = {
  ID: string
  Name: string
  Description: string
  Tags: string[]
  DraftVersionID: string | null
  PublishedVersionID: string | null
  CreatedAt: string
  CreatedBy: string | null
  UpdatedAt: string
  UpdatedBy: string | null
}

export type ExerciseIdentityInput = {
  Name: string
  Description: string
  Tags: string[]
}

export type ExercisesFilter = {
  search?: string
  tags?: string[]
  cursor?: string
  pageSize?: number
}

type RawExerciseListItem = Omit<ExerciseListItem, "Tags"> & { Tags: string[] | null }
type RawListResponse = {
  Exercises: RawExerciseListItem[] | null
  NextCursor: string
  HasMore: boolean
}
type RawExercise = Omit<Exercise, "Tags"> & { Tags: string[] | null }

function normalizeListItem(raw: RawExerciseListItem): ExerciseListItem {
  return { ...raw, Tags: raw.Tags ?? [] }
}

function normalizeExercise(raw: RawExercise): Exercise {
  return { ...raw, Tags: raw.Tags ?? [] }
}

function buildListQuery(filter?: ExercisesFilter): string {
  const p = new URLSearchParams()
  if (filter?.search) p.set("search", filter.search)
  for (const tag of filter?.tags ?? []) p.append("tags", tag)
  if (filter?.cursor) p.set("cursor", filter.cursor)
  if (filter?.pageSize) p.set("pageSize", String(filter.pageSize))
  return p.toString()
}

/** GET /api/exercises?search=&tags=&cursor=&pageSize= */
export async function listExercises(filter?: ExercisesFilter): Promise<ExercisesListResponse> {
  const qs = buildListQuery(filter)
  const raw = await apiGet<RawListResponse>(qs ? `${BASE}?${qs}` : BASE)
  return {
    Exercises: (raw.Exercises ?? []).map(normalizeListItem),
    NextCursor: raw.NextCursor,
    HasMore: raw.HasMore,
  }
}

/** GET /api/exercises/:id */
export async function getExercise(id: string): Promise<Exercise> {
  const raw = await apiGet<RawExercise>(`${BASE}/${id}`)
  return normalizeExercise(raw)
}

/** POST /api/exercises */
export async function createExercise(input: ExerciseIdentityInput): Promise<Exercise> {
  const raw = await apiPost<RawExercise>(BASE, input)
  return normalizeExercise(raw)
}

/** PATCH /api/exercises/:id */
export async function updateExercise(id: string, input: ExerciseIdentityInput): Promise<Exercise> {
  const raw = await apiPatch<RawExercise>(`${BASE}/${id}`, input)
  return normalizeExercise(raw)
}

/** DELETE /api/exercises/:id */
export function deleteExercise(id: string): Promise<void> {
  return apiDelete<void>(`${BASE}/${id}`)
}
```

- [ ] **Step 4: Реализовать `src/api/exercises/versions.ts`**

```ts
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
```

- [ ] **Step 5: Реализовать `src/api/exercises/files.ts`**

```ts
/**
 * files.ts — загрузка вложений (multipart) и download-URL.
 *
 * НЕ через apiPost: request() в client.ts всегда ставит Content-Type:
 * application/json, что ломает multipart boundary. Здесь собственный fetch
 * с credentials: "include" и тем же envelope-unwrap.
 */
import { ApiError } from "@/api/client"
import { awaitAuthBootstrap } from "@/lib/silentAuth"

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""
const FILES = "/api/exercises/files"

export type UploadedFile = { FileID: string; Name: string; Size: number }

/** URL для скачивания (GET /api/exercises/files/:fileID, cookie-auth — годится для <a href>). */
export function exerciseFileURL(fileId: string): string {
  return `${BASE_URL}${FILES}/${fileId}`
}

/** POST /api/exercises/files (multipart, поле "file"). */
export async function uploadExerciseFile(file: File): Promise<UploadedFile> {
  await awaitAuthBootstrap()
  const form = new FormData()
  form.append("file", file)
  const res = await fetch(`${BASE_URL}${FILES}`, {
    method: "POST",
    credentials: "include",
    body: form,
  })
  const raw = await res.text()
  let parsed: unknown = raw
  if (raw) {
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = raw
    }
  }
  const envelope =
    parsed && typeof parsed === "object"
      ? (parsed as { Status?: { Code?: number; Message?: string }; Data?: unknown })
      : undefined
  if (!res.ok) {
    throw new ApiError(res.status, parsed, envelope?.Status?.Message)
  }
  return envelope?.Data as UploadedFile
}
```

- [ ] **Step 6: Реализовать `src/lib/exerciseErrors.ts`**

```ts
/**
 * exerciseErrors.ts — словарь FullCode → i18n-ключ для доменных ошибок
 * exercise (objectCode 9) и media (objectCode 10).
 *
 * FullCode = informCode*10000 + objectCode*100 + detailCode
 * (inform: 2=InvalidData, 3=NotFound, 4=Exists, 7=Conflict).
 * Источник: AP Backend internal/model/exercise/errors.go, internal/model/media/errors.go.
 * Неизвестный код → generic + Status.Message бэка. 401/403 сюда не попадают
 * (их перехватывает client.ts / RBAC-гейты).
 */
import { ApiError } from "@/api/client"
import { t } from "@/i18n/t"

export const ERR_EXERCISE_EXISTS = 40903
export const ERR_EXERCISE_MODIFIED = 70904
export const ERR_NO_DRAFT = 70905
export const ERR_DRAFT_ALREADY_EXISTS = 70906

const CODE_TO_KEY: Record<number, string> = {
  // exercise: not found / exists / conflicts
  30901: "admin.ex.err.notFound",
  30902: "admin.ex.err.versionNotFound",
  40903: "admin.ex.err.exists",
  70904: "admin.ex.err.modified",
  70905: "admin.ex.err.noDraft",
  70906: "admin.ex.err.draftExists",
  70907: "admin.ex.err.secretsNotConfigured",
  // exercise: identity validation
  20908: "admin.ex.err.nameInvalid",
  20909: "admin.ex.err.descriptionTooLong",
  20910: "admin.ex.err.tagsInvalid",
  // exercise: structural validation
  20911: "admin.ex.err.noVariants",
  20912: "admin.ex.err.taskCountMismatch",
  20913: "admin.ex.err.taskNameInvalid",
  20914: "admin.ex.err.difficultyInvalid",
  20915: "admin.ex.err.flagInvalid",
  20916: "admin.ex.err.deviceNameInvalid",
  20917: "admin.ex.err.deviceTypeInvalid",
  20918: "admin.ex.err.interfaceInvalid",
  20919: "admin.ex.err.connectionEndpointsInvalid",
  20927: "admin.ex.err.externalInvalid",
  20928: "admin.ex.err.connectionArity",
  // exercise: publish-time graph validation
  20920: "admin.ex.err.endpointUnresolved",
  20921: "admin.ex.err.portInUse",
  20924: "admin.ex.err.flagDeviceUnresolved",
  20929: "admin.ex.err.vpnDisabled",
  20930: "admin.ex.err.internetDisabled",
  20931: "admin.ex.err.vpnGatewayInUse",
  20932: "admin.ex.err.internetGatewayInUse",
  20933: "admin.ex.err.deviceNameDuplicate",
  // exercise: placeholders
  20925: "admin.ex.err.placeholderInvalid",
  20926: "admin.ex.err.placeholderNode",
  // media (вложения)
  31001: "admin.ex.err.fileNotFound",
  21002: "admin.ex.err.fileTooLarge",
  71003: "admin.ex.err.storageNotConfigured",
}

type EnvelopeBody = { Status?: { Code?: number; Message?: string } }

/** FullCode из тела ошибки или null (не ApiError / нет envelope). */
export function exerciseErrorCode(e: unknown): number | null {
  if (!(e instanceof ApiError)) return null
  const body = e.body as EnvelopeBody | null | undefined
  const code = body?.Status?.Code
  return typeof code === "number" ? code : null
}

/** Человекочитаемое (украинское) сообщение для любой ошибки API exercises. */
export function exerciseErrorMessage(e: unknown): string {
  const code = exerciseErrorCode(e)
  if (code !== null) {
    const key = CODE_TO_KEY[code]
    if (key) return t(key)
    const message = ((e as ApiError).body as EnvelopeBody | null | undefined)?.Status?.Message
    if (message) return `${t("admin.ex.err.generic")}: ${message}`
  }
  return t("admin.ex.err.generic")
}
```

- [ ] **Step 7: Добавить i18n-ключи ошибок в оба каталога**

В `messages/en.json` добавить перед закрывающей `}` (запятая у предыдущей строки):

```json
  "admin.ex.err.generic": "Operation failed",
  "admin.ex.err.notFound": "Exercise not found",
  "admin.ex.err.versionNotFound": "Version not found",
  "admin.ex.err.exists": "An exercise with this name already exists",
  "admin.ex.err.modified": "The data changed on the server — reload the page",
  "admin.ex.err.noDraft": "The exercise has no draft",
  "admin.ex.err.draftExists": "The exercise already has a draft",
  "admin.ex.err.secretsNotConfigured": "Secret storage is not configured",
  "admin.ex.err.nameInvalid": "Name must be 3–50 characters",
  "admin.ex.err.descriptionTooLong": "Description must be at most 2000 characters",
  "admin.ex.err.tagsInvalid": "Tags: 1–30 characters each, at most 20",
  "admin.ex.err.noVariants": "A version must have at least one variant",
  "admin.ex.err.taskCountMismatch": "All variants must have the same number of tasks",
  "admin.ex.err.taskNameInvalid": "Task name must be 3–50 characters",
  "admin.ex.err.difficultyInvalid": "Invalid task difficulty",
  "admin.ex.err.flagInvalid": "Flag values must not be blank",
  "admin.ex.err.deviceNameInvalid": "Device name must be a DNS label (1–63 characters)",
  "admin.ex.err.deviceTypeInvalid": "Invalid device type, or a switch/hub with extra fields",
  "admin.ex.err.interfaceInvalid": "Invalid device interface",
  "admin.ex.err.externalInvalid": "Invalid external access (port 1–65535, http/https)",
  "admin.ex.err.connectionArity": "A connection must have exactly two endpoints",
  "admin.ex.err.connectionEndpointsInvalid": "Invalid connection endpoints",
  "admin.ex.err.endpointUnresolved": "A connection references a missing device or interface",
  "admin.ex.err.portInUse": "A port may be used by at most one connection",
  "admin.ex.err.flagDeviceUnresolved": "A task flag references a device absent from the topology",
  "admin.ex.err.vpnDisabled": "VPN is not enabled in this variant's topology",
  "admin.ex.err.internetDisabled": "Internet is not enabled in this variant's topology",
  "admin.ex.err.vpnGatewayInUse": "The VPN gateway is already connected",
  "admin.ex.err.internetGatewayInUse": "The Internet gateway is already connected",
  "admin.ex.err.deviceNameDuplicate": "Device names must be unique within the topology",
  "admin.ex.err.placeholderInvalid": "A description placeholder is malformed",
  "admin.ex.err.placeholderNode": "A placeholder references a node absent from the topology",
  "admin.ex.err.fileNotFound": "File not found",
  "admin.ex.err.fileTooLarge": "File exceeds the maximum upload size",
  "admin.ex.err.storageNotConfigured": "File storage is not configured"
```

В `messages/uk.json` — те же ключи:

```json
  "admin.ex.err.generic": "Не вдалося виконати операцію",
  "admin.ex.err.notFound": "Завдання не знайдено",
  "admin.ex.err.versionNotFound": "Версію не знайдено",
  "admin.ex.err.exists": "Завдання з такою назвою вже існує",
  "admin.ex.err.modified": "Дані змінилися на сервері — оновіть сторінку",
  "admin.ex.err.noDraft": "У завдання немає чернетки",
  "admin.ex.err.draftExists": "У завдання вже є чернетка",
  "admin.ex.err.secretsNotConfigured": "Сховище секретів не налаштовано",
  "admin.ex.err.nameInvalid": "Назва має містити 3–50 символів",
  "admin.ex.err.descriptionTooLong": "Опис має бути не довшим за 2000 символів",
  "admin.ex.err.tagsInvalid": "Теги: 1–30 символів кожен, не більше 20",
  "admin.ex.err.noVariants": "Версія має містити принаймні один варіант",
  "admin.ex.err.taskCountMismatch": "Усі варіанти мають містити однакову кількість задач",
  "admin.ex.err.taskNameInvalid": "Назва задачі має містити 3–50 символів",
  "admin.ex.err.difficultyInvalid": "Некоректна складність задачі",
  "admin.ex.err.flagInvalid": "Значення прапорця не можуть бути порожніми",
  "admin.ex.err.deviceNameInvalid": "Імʼя пристрою має бути DNS-міткою (1–63 символи)",
  "admin.ex.err.deviceTypeInvalid": "Некоректний тип пристрою або свіч/хаб із зайвими полями",
  "admin.ex.err.interfaceInvalid": "Некоректний інтерфейс пристрою",
  "admin.ex.err.externalInvalid": "Некоректний зовнішній доступ (порт 1–65535, http/https)",
  "admin.ex.err.connectionArity": "Зʼєднання має мати рівно два кінці",
  "admin.ex.err.connectionEndpointsInvalid": "Некоректні кінці зʼєднання",
  "admin.ex.err.endpointUnresolved": "Зʼєднання посилається на відсутній пристрій або інтерфейс",
  "admin.ex.err.portInUse": "Порт може використовуватися лише одним зʼєднанням",
  "admin.ex.err.flagDeviceUnresolved": "Прапорець задачі посилається на пристрій, відсутній у топології",
  "admin.ex.err.vpnDisabled": "VPN не увімкнено в топології цього варіанта",
  "admin.ex.err.internetDisabled": "Інтернет не увімкнено в топології цього варіанта",
  "admin.ex.err.vpnGatewayInUse": "VPN-шлюз уже підключено",
  "admin.ex.err.internetGatewayInUse": "Інтернет-шлюз уже підключено",
  "admin.ex.err.deviceNameDuplicate": "Імена пристроїв мають бути унікальними в межах топології",
  "admin.ex.err.placeholderInvalid": "Плейсхолдер опису сформовано некоректно",
  "admin.ex.err.placeholderNode": "Плейсхолдер посилається на вузол, відсутній у топології",
  "admin.ex.err.fileNotFound": "Файл не знайдено",
  "admin.ex.err.fileTooLarge": "Файл перевищує максимальний розмір завантаження",
  "admin.ex.err.storageNotConfigured": "Файлове сховище не налаштовано"
```

- [ ] **Step 8: Прогнать тесты — все зелёные**

Run: `npx vitest run src/api/exercises src/lib/exerciseErrors.test.ts`
Expected: PASS (все describe из Step 1).

- [ ] **Step 9: Полная верификация и коммит**

Run: `npm run lint && npm run test`
Expected: 0 ошибок lint, все тесты PASS.

```bash
git add src/api/exercises/catalog.ts src/api/exercises/catalog.test.ts src/api/exercises/versions.ts src/api/exercises/versions.test.ts src/api/exercises/files.ts src/api/exercises/files.test.ts src/lib/exerciseErrors.ts src/lib/exerciseErrors.test.ts messages/en.json messages/uk.json
git commit -m "feat(admin): exercises API clients, normalize, error dictionary" -- src/api/exercises/catalog.ts src/api/exercises/catalog.test.ts src/api/exercises/versions.ts src/api/exercises/versions.test.ts src/api/exercises/files.ts src/api/exercises/files.test.ts src/lib/exerciseErrors.ts src/lib/exerciseErrors.test.ts messages/en.json messages/uk.json
git show --stat HEAD   # только перечисленные файлы, чужой staged-индекс не задет
```

---

### Task 2: zod-схемы драфта и identity + тесты

**Files:**
- Create: `src/lib/exerciseSchemas.ts`
- Create: `src/lib/exerciseSchemas.test.ts`
- Modify: `messages/en.json` (ключи `admin.ex.val.*`)
- Modify: `messages/uk.json` (те же ключи)

**Interfaces:**
- Consumes: типы из `@/api/exercises/versions` (`Difficulty`, `DeviceType`, `IPType`, `Protocol`, `PlaceholderKind`, `LexicalDoc`, `NormalizedTask`, `NormalizedDevice`, `NormalizedTopology`, `NormalizedVariant`); `t` из `@/i18n/t`; `zod`.
- Produces (контракт для Task 3–11):
  - regex/хелперы: `DNS_LABEL_RE`, `MAC_RE`, `isValidCIDR(v: string): boolean`, `isValidIPv4(v: string): boolean`;
  - `identitySchema` (zod), `type IdentityFormValues = { Name: string; Description: string; Tags: string[] }`;
  - `draftSchema` (zod на весь снапшот);
  - form-типы: `type ExternalFormValues = { Enabled: boolean; Port: number; Protocol: Protocol }`, `type DeviceFormValues = Omit<NormalizedDevice, "External"> & { External: ExternalFormValues }`, `type TopologyFormValues = Omit<NormalizedTopology, "Devices"> & { Devices: DeviceFormValues[] }`, `type VariantFormValues = Omit<NormalizedVariant, "Topology"> & { Topology: TopologyFormValues }`, `type TaskFormValues = NormalizedTask`, `type PlaceholderFormValues = { Kind: PlaceholderKind; IPReference: string; Octets1to3: string; LastOctet: number; ShowMask: boolean; DeviceName: string }`, `type DraftFormValues = { AdminNote: string; RegenerateFlagsOnPublish: boolean; Variants: VariantFormValues[] }`;
  - фабрики: `emptyTask(): TaskFormValues`, `emptyInterface(): NormalizedInterface-shape`, `emptyDevice(): DeviceFormValues` (ID = `crypto.randomUUID()`), `emptyPlaceholder(): PlaceholderFormValues`, `emptyVariant(index: number): VariantFormValues`, `emptyDraft(): DraftFormValues`.

Зеркало домена (до запроса): имя задания/задачи 3–50; DNS label `^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$`; MAC — 6 октетов; CIDR — regex + parse-check октетов/префикса; port 1–65535; protocol `http|https`; static → ≥1 адрес / non-static → без адресов; gateway только при static; свитч/хаб без Image/Interfaces/EnvVars/External; вариант ≥1 задачи; равное число задач у всех вариантов (superRefine — `ErrTaskCountMismatch`).

- [ ] **Step 1: Написать падающие табличные тесты**

`src/lib/exerciseSchemas.test.ts`:

```ts
/**
 * exerciseSchemas.test.ts — табличные тесты zod-зеркала домена.
 * t мокается «ключ → ключ»: сообщения не проверяем на язык, только на факт ошибки.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))

import {
  DNS_LABEL_RE,
  MAC_RE,
  isValidCIDR,
  isValidIPv4,
  identitySchema,
  draftSchema,
  emptyDraft,
  emptyVariant,
  emptyTask,
  emptyDevice,
  type DraftFormValues,
} from './exerciseSchemas'

// ── Регексы и парсеры ──────────────────────────────────────────────────────────

describe('DNS_LABEL_RE', () => {
  it.each([
    ['web', true],
    ['a', true],
    ['web-01', true],
    ['a'.repeat(63), true],
    ['', false],
    ['-web', false],
    ['web-', false],
    ['Web', false],
    ['web_01', false],
    ['a'.repeat(64), false],
  ])('%s → %s', (input, ok) => {
    expect(DNS_LABEL_RE.test(input)).toBe(ok)
  })
})

describe('MAC_RE', () => {
  it.each([
    ['02:42:ac:11:00:02', true],
    ['02-42-AC-11-00-02', true],
    ['02:42:ac:11:00', false],
    ['02:42:ac:11:00:02:99', false],
    ['0242ac110002', false],
    ['gg:42:ac:11:00:02', false],
  ])('%s → %s', (input, ok) => {
    expect(MAC_RE.test(input)).toBe(ok)
  })
})

describe('isValidCIDR', () => {
  it.each([
    ['10.0.0.0/24', true],
    ['192.168.1.5/32', true],
    ['0.0.0.0/0', true],
    ['10.0.0.0', false],
    ['10.0.0.0/33', false],
    ['256.0.0.0/24', false],
    ['10.0.0/24', false],
    ['abc/24', false],
  ])('%s → %s', (input, ok) => {
    expect(isValidCIDR(input)).toBe(ok)
  })
})

describe('isValidIPv4', () => {
  it.each([
    ['10.0.0.1', true],
    ['255.255.255.255', true],
    ['256.0.0.1', false],
    ['10.0.0.1/24', false],
    ['', false],
  ])('%s → %s', (input, ok) => {
    expect(isValidIPv4(input)).toBe(ok)
  })
})

// ── identitySchema ─────────────────────────────────────────────────────────────

describe('identitySchema', () => {
  const ok = { Name: 'SQL injection', Description: 'Intro', Tags: ['web'] }

  it('accepts a valid identity', () => {
    expect(identitySchema.safeParse(ok).success).toBe(true)
  })

  it.each([
    ['name too short', { ...ok, Name: 'ab' }],
    ['name too long', { ...ok, Name: 'a'.repeat(51) }],
    ['description too long', { ...ok, Description: 'a'.repeat(2001) }],
    ['empty tag', { ...ok, Tags: [''] }],
    ['tag too long', { ...ok, Tags: ['a'.repeat(31)] }],
    ['21 tags', { ...ok, Tags: Array.from({ length: 21 }, (_, i) => `t${i}`) }],
  ])('rejects %s', (_label, input) => {
    expect(identitySchema.safeParse(input).success).toBe(false)
  })
})

// ── draftSchema ────────────────────────────────────────────────────────────────

function validDraft(): DraftFormValues {
  const draft = emptyDraft()
  draft.Variants[0].Tasks[0].Name = 'Find the flag'
  return draft
}

describe('draftSchema', () => {
  it('accepts a minimal valid draft (1 variant, 1 named task)', () => {
    const result = draftSchema.safeParse(validDraft())
    expect(result.success).toBe(true)
  })

  it('rejects a variant with zero tasks', () => {
    const draft = validDraft()
    draft.Variants[0].Tasks = []
    expect(draftSchema.safeParse(draft).success).toBe(false)
  })

  it('rejects unequal task counts across variants (superRefine)', () => {
    const draft = validDraft()
    const second = emptyVariant(2)
    second.Tasks = [emptyTask(), emptyTask()]
    second.Tasks.forEach((task, i) => { task.Name = `Task ${i + 1} ok` })
    draft.Variants.push(second)
    const result = draftSchema.safeParse(draft)
    expect(result.success).toBe(false)
    const paths = result.success ? [] : result.error.issues.map((i) => i.path.join('.'))
    expect(paths).toContain('Variants.1.Tasks')
  })

  it('rejects a task name shorter than 3 chars', () => {
    const draft = validDraft()
    draft.Variants[0].Tasks[0].Name = 'ab'
    expect(draftSchema.safeParse(draft).success).toBe(false)
  })

  it('rejects a blank flag value', () => {
    const draft = validDraft()
    draft.Variants[0].Tasks[0].Flag = ['  ']
    expect(draftSchema.safeParse(draft).success).toBe(false)
  })

  it('accepts an empty flag list (random flag semantics)', () => {
    const draft = validDraft()
    draft.Variants[0].Tasks[0].Flag = []
    expect(draftSchema.safeParse(draft).success).toBe(true)
  })

  it('rejects a device name that is not a DNS label', () => {
    const draft = validDraft()
    const device = emptyDevice()
    device.Name = 'Bad_Name'
    draft.Variants[0].Topology.Devices.push(device)
    expect(draftSchema.safeParse(draft).success).toBe(false)
  })

  it('rejects a switch with interfaces', () => {
    const draft = validDraft()
    const device = emptyDevice()
    device.Name = 'sw1'
    device.Type = 'unmanaged-switch'
    // emptyDevice() кладёт один дефолтный интерфейс — свитч обязан быть «голым»
    expect(device.Interfaces.length).toBeGreaterThan(0)
    draft.Variants[0].Topology.Devices.push(device)
    expect(draftSchema.safeParse(draft).success).toBe(false)
  })

  it('accepts a bare switch', () => {
    const draft = validDraft()
    const device = emptyDevice()
    device.Name = 'sw1'
    device.Type = 'unmanaged-switch'
    device.Interfaces = []
    device.EnvVars = []
    device.Image = ''
    device.External = { Enabled: false, Port: 80, Protocol: 'http' }
    draft.Variants[0].Topology.Devices.push(device)
    expect(draftSchema.safeParse(draft).success).toBe(true)
  })

  it('static IP requires at least one valid CIDR address', () => {
    const draft = validDraft()
    const device = emptyDevice()
    device.Name = 'web'
    device.Interfaces[0].IP = { Type: 'static', Addresses: [], Gateway: '' }
    draft.Variants[0].Topology.Devices.push(device)
    expect(draftSchema.safeParse(draft).success).toBe(false)

    device.Interfaces[0].IP.Addresses = ['10.0.0.2/24']
    expect(draftSchema.safeParse(draft).success).toBe(true)

    device.Interfaces[0].IP.Addresses = ['10.0.0.2']
    expect(draftSchema.safeParse(draft).success).toBe(false)
  })

  it('non-static IP must have no addresses and no gateway', () => {
    const draft = validDraft()
    const device = emptyDevice()
    device.Name = 'web'
    device.Interfaces[0].IP = { Type: 'dhcp', Addresses: ['10.0.0.2/24'], Gateway: '' }
    draft.Variants[0].Topology.Devices.push(device)
    expect(draftSchema.safeParse(draft).success).toBe(false)

    device.Interfaces[0].IP = { Type: 'dhcp', Addresses: [], Gateway: '10.0.0.1' }
    expect(draftSchema.safeParse(draft).success).toBe(false)

    device.Interfaces[0].IP = { Type: 'dhcp', Addresses: [], Gateway: '' }
    expect(draftSchema.safeParse(draft).success).toBe(true)
  })

  it('gateway must be a valid IPv4 when static', () => {
    const draft = validDraft()
    const device = emptyDevice()
    device.Name = 'web'
    device.Interfaces[0].IP = { Type: 'static', Addresses: ['10.0.0.2/24'], Gateway: 'not-an-ip' }
    draft.Variants[0].Topology.Devices.push(device)
    expect(draftSchema.safeParse(draft).success).toBe(false)

    device.Interfaces[0].IP.Gateway = '10.0.0.1'
    expect(draftSchema.safeParse(draft).success).toBe(true)
  })

  it('invalid MAC is rejected, empty MAC is fine', () => {
    const draft = validDraft()
    const device = emptyDevice()
    device.Name = 'web'
    device.Interfaces[0].MAC = 'zz:zz'
    draft.Variants[0].Topology.Devices.push(device)
    expect(draftSchema.safeParse(draft).success).toBe(false)

    device.Interfaces[0].MAC = ''
    expect(draftSchema.safeParse(draft).success).toBe(true)
  })

  it('enabled external access requires port 1–65535', () => {
    const draft = validDraft()
    const device = emptyDevice()
    device.Name = 'web'
    device.External = { Enabled: true, Port: 0, Protocol: 'http' }
    draft.Variants[0].Topology.Devices.push(device)
    expect(draftSchema.safeParse(draft).success).toBe(false)

    device.External.Port = 70000
    expect(draftSchema.safeParse(draft).success).toBe(false)

    device.External.Port = 8080
    expect(draftSchema.safeParse(draft).success).toBe(true)
  })

  it('device endpoint requires a chosen device', () => {
    const draft = validDraft()
    draft.Variants[0].Topology.Connections = [{
      Endpoints: [
        { Kind: 'device', DeviceID: '', Interface: '' },
        { Kind: 'vpn', DeviceID: '', Interface: '' },
      ],
    }]
    expect(draftSchema.safeParse(draft).success).toBe(false)

    draft.Variants[0].Topology.Connections[0].Endpoints[0].DeviceID = 'some-uuid'
    expect(draftSchema.safeParse(draft).success).toBe(true)
  })

  it('ip placeholder requires a known IPReference; external.link requires a device', () => {
    const draft = validDraft()
    draft.Variants[0].Tasks[0].Placeholders = [{
      Kind: 'ip', IPReference: 'bogus', Octets1to3: '', LastOctet: 0, ShowMask: false, DeviceName: '',
    }]
    expect(draftSchema.safeParse(draft).success).toBe(false)

    draft.Variants[0].Tasks[0].Placeholders = [{
      Kind: 'external.link', IPReference: '', Octets1to3: '', LastOctet: 0, ShowMask: false, DeviceName: '',
    }]
    expect(draftSchema.safeParse(draft).success).toBe(false)

    draft.Variants[0].Tasks[0].Placeholders = [{
      Kind: 'ip', IPReference: 'vpn', Octets1to3: '', LastOctet: 13, ShowMask: true, DeviceName: '',
    }]
    expect(draftSchema.safeParse(draft).success).toBe(true)
  })
})

// ── Фабрики ────────────────────────────────────────────────────────────────────

describe('factories', () => {
  it('emptyDevice generates a client-side uuid', () => {
    const a = emptyDevice()
    const b = emptyDevice()
    expect(a.ID).toMatch(/^[0-9a-f-]{36}$/)
    expect(a.ID).not.toBe(b.ID)
  })

  it('emptyDraft has one variant with one task', () => {
    const draft = emptyDraft()
    expect(draft.Variants).toHaveLength(1)
    expect(draft.Variants[0].Tasks).toHaveLength(1)
    expect(draft.Variants[0].Index).toBe(1)
  })
})
```

- [ ] **Step 2: Запустить тесты — убедиться, что падают**

Run: `npx vitest run src/lib/exerciseSchemas.test.ts`
Expected: FAIL — «Cannot find module './exerciseSchemas'».

- [ ] **Step 3: Реализовать `src/lib/exerciseSchemas.ts`**

```ts
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
```

- [ ] **Step 4: Добавить i18n-ключи валидации**

В `messages/en.json`:

```json
  "admin.ex.val.name": "Name must be 3–50 characters",
  "admin.ex.val.description": "Description must be at most 2000 characters",
  "admin.ex.val.tag": "A tag must be 1–30 characters",
  "admin.ex.val.tags": "At most 20 tags",
  "admin.ex.val.taskName": "Task name must be 3–50 characters",
  "admin.ex.val.flagBlank": "A flag value must not be blank",
  "admin.ex.val.taskRequired": "A variant needs at least one task",
  "admin.ex.val.variantRequired": "At least one variant is required",
  "admin.ex.val.taskCountMismatch": "All variants must have the same number of tasks",
  "admin.ex.val.deviceName": "Device name must be a DNS label: lowercase letters, digits, hyphens",
  "admin.ex.val.forwardingBare": "A switch/hub has no image, interfaces, env vars or external access",
  "admin.ex.val.ifaceName": "Interface name is required",
  "admin.ex.val.mac": "MAC must be six octets, e.g. 02:42:ac:11:00:02",
  "admin.ex.val.cidr": "Address must be CIDR, e.g. 10.0.0.2/24",
  "admin.ex.val.addressesRequired": "Static IP needs at least one address",
  "admin.ex.val.addressesForbidden": "Addresses are allowed only with static IP",
  "admin.ex.val.gateway": "Gateway must be a valid IPv4 address",
  "admin.ex.val.gatewayStaticOnly": "Gateway is allowed only with static IP",
  "admin.ex.val.port": "Port must be between 1 and 65535",
  "admin.ex.val.endpointDevice": "Choose a device for this endpoint",
  "admin.ex.val.connectionArity": "A connection has exactly two endpoints",
  "admin.ex.val.lastOctet": "Last octet must be 0–255",
  "admin.ex.val.placeholderIPRef": "Choose an IP source: VPN, Internet or static octets",
  "admin.ex.val.placeholderDevice": "Choose a device with external access",
  "admin.ex.val.envName": "Variable name is required"
```

В `messages/uk.json`:

```json
  "admin.ex.val.name": "Назва має містити 3–50 символів",
  "admin.ex.val.description": "Опис має бути не довшим за 2000 символів",
  "admin.ex.val.tag": "Тег має містити 1–30 символів",
  "admin.ex.val.tags": "Не більше 20 тегів",
  "admin.ex.val.taskName": "Назва задачі має містити 3–50 символів",
  "admin.ex.val.flagBlank": "Значення прапорця не може бути порожнім",
  "admin.ex.val.taskRequired": "Варіант має містити принаймні одну задачу",
  "admin.ex.val.variantRequired": "Потрібен принаймні один варіант",
  "admin.ex.val.taskCountMismatch": "Усі варіанти мають містити однакову кількість задач",
  "admin.ex.val.deviceName": "Імʼя пристрою — DNS-мітка: малі літери, цифри, дефіси",
  "admin.ex.val.forwardingBare": "Свіч/хаб не має образу, інтерфейсів, змінних оточення чи зовнішнього доступу",
  "admin.ex.val.ifaceName": "Вкажіть імʼя інтерфейсу",
  "admin.ex.val.mac": "MAC — шість октетів, напр. 02:42:ac:11:00:02",
  "admin.ex.val.cidr": "Адреса має бути в CIDR, напр. 10.0.0.2/24",
  "admin.ex.val.addressesRequired": "Статичний IP потребує принаймні однієї адреси",
  "admin.ex.val.addressesForbidden": "Адреси дозволені лише для статичного IP",
  "admin.ex.val.gateway": "Шлюз має бути коректною IPv4-адресою",
  "admin.ex.val.gatewayStaticOnly": "Шлюз дозволений лише для статичного IP",
  "admin.ex.val.port": "Порт має бути в межах 1–65535",
  "admin.ex.val.endpointDevice": "Оберіть пристрій для цього кінця зʼєднання",
  "admin.ex.val.connectionArity": "Зʼєднання має рівно два кінці",
  "admin.ex.val.lastOctet": "Останній октет — 0–255",
  "admin.ex.val.placeholderIPRef": "Оберіть джерело IP: VPN, Інтернет або статичні октети",
  "admin.ex.val.placeholderDevice": "Оберіть пристрій із зовнішнім доступом",
  "admin.ex.val.envName": "Вкажіть імʼя змінної"
```

- [ ] **Step 5: Прогнать тесты — зелёные**

Run: `npx vitest run src/lib/exerciseSchemas.test.ts`
Expected: PASS.

- [ ] **Step 6: Полная верификация и коммит**

Run: `npm run lint && npm run test`
Expected: PASS.

```bash
git add src/lib/exerciseSchemas.ts src/lib/exerciseSchemas.test.ts messages/en.json messages/uk.json
git commit -m "feat(admin): zod draft/identity schemas mirroring exercise domain rules" -- src/lib/exerciseSchemas.ts src/lib/exerciseSchemas.test.ts messages/en.json messages/uk.json
git show --stat HEAD
```

---

### Task 3: Каталог — список, поиск, теги, создание + nav + i18n

**Files:**
- Create: `src/components/exercises/TagInput.tsx` (общий chip-ввод тегов: форма identity и фильтр каталога)
- Create: `src/app/exercises/page.tsx` (заменяет заглушку «Незабаром»)
- Create: `src/app/exercises/page.test.tsx`
- Modify: `src/components/shell/Sidebar.tsx` (пункт «Завдання» в `SECTIONS`)
- Modify: `messages/en.json`, `messages/uk.json`

**Interfaces:**
- Consumes: `listExercises`, `createExercise`, `type ExerciseListItem` из `@/api/exercises/catalog`; `identitySchema`, `type IdentityFormValues` из `@/lib/exerciseSchemas`; `exerciseErrorMessage` из `@/lib/exerciseErrors`; `useRole().can`, `t`; ui: `Input`, `Button`, `Dialog*`, `Alert`, `Spinner`; RHF: `useForm` + `zodResolver`, `Controller`.
- Produces: `TagInput({ value: string[]; onChange: (v: string[]) => void; disabled?: boolean; placeholder?: string })` — используется в Task 4; страница `/exercises` со строками-ссылками на `/exercises/detail?id=<ID>`.

- [ ] **Step 1: Написать падающий тест страницы**

`src/app/exercises/page.test.tsx`:

```tsx
/**
 * page.test.tsx — каталог exercises: рендер списка, debounce-поиск, фильтр тегов.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))
vi.mock('@/lib/useRole', () => ({
  useRole: () => ({ me: null, role: 'admin', isLoading: false, permissions: ['*'], can: () => true }),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/api/exercises/catalog', () => ({
  listExercises: vi.fn(),
  createExercise: vi.fn(),
}))

import { listExercises } from '@/api/exercises/catalog'
import Page from './page'

const mockList = vi.mocked(listExercises)

// jsdom не имеет IntersectionObserver — инфскролл-сентинел получает заглушку.
class IO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('IntersectionObserver', IO)

const item = {
  ID: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  Name: 'SQLi basics',
  Description: 'Intro to SQL injection',
  Tags: ['web', 'sql'],
  HasDraft: true,
  HasPublished: false,
  CreatedAt: '2026-01-01T00:00:00Z',
  UpdatedAt: '2026-01-02T00:00:00Z',
}

describe('exercises catalog page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockList.mockResolvedValue({ Exercises: [item], NextCursor: '', HasMore: false })
  })

  it('renders a row with name, tags and draft status', async () => {
    render(<Page />)
    expect(await screen.findByText('SQLi basics')).toBeInTheDocument()
    expect(screen.getByText('web')).toBeInTheDocument()
    expect(screen.getByText('sql')).toBeInTheDocument()
    expect(screen.getByText('admin.ex.status.draft')).toBeInTheDocument()
    const link = screen.getByText('SQLi basics').closest('a')
    expect(link).toHaveAttribute('href', `/exercises/detail?id=${item.ID}`)
  })

  it('renders the empty state', async () => {
    mockList.mockResolvedValue({ Exercises: [], NextCursor: '', HasMore: false })
    render(<Page />)
    expect(await screen.findByText('admin.ex.empty')).toBeInTheDocument()
  })

  it('debounces search and passes it to listExercises', async () => {
    render(<Page />)
    await screen.findByText('SQLi basics')
    fireEvent.change(screen.getByPlaceholderText('admin.ex.search'), { target: { value: 'sql' } })
    await waitFor(() => {
      const calls = mockList.mock.calls
      expect(calls[calls.length - 1][0]).toMatchObject({ search: 'sql' })
    })
  })

  it('adds a tag filter chip and passes tags to listExercises', async () => {
    render(<Page />)
    await screen.findByText('SQLi basics')
    const tagBox = screen.getByPlaceholderText('admin.ex.filterTags.placeholder')
    fireEvent.change(tagBox, { target: { value: 'crypto' } })
    fireEvent.keyDown(tagBox, { key: 'Enter' })
    await waitFor(() => {
      const calls = mockList.mock.calls
      expect(calls[calls.length - 1][0]).toMatchObject({ tags: ['crypto'] })
    })
  })
})
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `npx vitest run src/app/exercises/page.test.tsx`
Expected: FAIL — страница пока рендерит заглушку `admin.comingSoon` (нет строк/поиска).

- [ ] **Step 3: Реализовать `src/components/exercises/TagInput.tsx`**

```tsx
"use client"

import { useState } from "react"
import { X } from "lucide-react"

/**
 * TagInput — chip-ввод списка строк (теги задания, фильтр каталога).
 * Enter/запятая/blur добавляет чип, Backspace на пустом поле удаляет последний.
 */
export function TagInput({
  value,
  onChange,
  disabled,
  placeholder,
}: {
  value: string[]
  onChange: (v: string[]) => void
  disabled?: boolean
  placeholder?: string
}) {
  const [draft, setDraft] = useState("")

  function commit() {
    const tag = draft.trim()
    setDraft("")
    if (!tag || value.includes(tag)) return
    onChange([...value, tag])
  }

  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1.5">
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-secondary/40 px-2 py-0.5 text-xs text-foreground"
        >
          {tag}
          {!disabled && (
            <button type="button" aria-label={`remove-${tag}`} onClick={() => onChange(value.filter((x) => x !== tag))}>
              <X className="h-3 w-3 opacity-60 hover:opacity-100" />
            </button>
          )}
        </span>
      ))}
      <input
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault()
            commit()
          }
          if (e.key === "Backspace" && draft === "" && value.length > 0) {
            onChange(value.slice(0, -1))
          }
        }}
        onBlur={commit}
        placeholder={placeholder}
        className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  )
}
```

- [ ] **Step 4: Реализовать `src/app/exercises/page.tsx`**

Паттерн `src/app/users/page.tsx`: cursor + IntersectionObserver, debounce 300ms, PAGE=50.

```tsx
"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { t } from "@/i18n/t"
import { useRole } from "@/lib/useRole"
import { listExercises, createExercise, type ExerciseListItem } from "@/api/exercises/catalog"
import { identitySchema, type IdentityFormValues } from "@/lib/exerciseSchemas"
import { exerciseErrorMessage } from "@/lib/exerciseErrors"
import { TagInput } from "@/components/exercises/TagInput"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from "@/components/ui/form"

const PAGE = 50

function StatusBadges({ item }: { item: ExerciseListItem }) {
  return (
    <span className="flex flex-wrap gap-1">
      {item.HasDraft && (
        <span className="rounded-full bg-secondary/40 px-2 py-0.5 text-xs">{t("admin.ex.status.draft")}</span>
      )}
      {item.HasPublished && (
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">{t("admin.ex.status.published")}</span>
      )}
      {!item.HasDraft && !item.HasPublished && <span className="text-xs text-muted-foreground">—</span>}
    </span>
  )
}

function CreateExerciseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const form = useForm<IdentityFormValues>({
    resolver: zodResolver(identitySchema),
    defaultValues: { Name: "", Description: "", Tags: [] },
  })
  const busy = form.formState.isSubmitting

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null)
    try {
      const created = await createExercise(values)
      router.push(`/exercises/detail?id=${created.ID}`)
    } catch (e) {
      setError(exerciseErrorMessage(e))
    }
  })

  function handleOpenChange(next: boolean) {
    onOpenChange(next)
    if (!next) {
      form.reset()
      setError(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.ex.create.title")}</DialogTitle>
          <DialogDescription>{t("admin.ex.create.description")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-3">
            <FormField control={form.control} name="Name" render={({ field }) => (
              <FormItem>
                <FormLabel>{t("admin.ex.field.name")}</FormLabel>
                <FormControl><Input {...field} disabled={busy} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="Description" render={({ field }) => (
              <FormItem>
                <FormLabel>{t("admin.ex.field.description")}</FormLabel>
                <FormControl><Input {...field} disabled={busy} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="Tags" render={({ field }) => (
              <FormItem>
                <FormLabel>{t("admin.ex.field.tags")}</FormLabel>
                <FormControl>
                  <TagInput value={field.value} onChange={field.onChange} disabled={busy} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            {error && (
              <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={busy} onClick={() => handleOpenChange(false)}>
                {t("admin.ex.create.cancel")}
              </Button>
              <Button type="submit" disabled={busy}>{t("admin.ex.create.submit")}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default function Page() {
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [rows, setRows] = useState<ExerciseListItem[]>([])
  const [cursor, setCursor] = useState("")
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const { can } = useRole()

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])

  const buildFilter = useCallback(
    (cur: string) => ({
      ...(debounced ? { search: debounced } : {}),
      ...(tags.length > 0 ? { tags } : {}),
      ...(cur ? { cursor: cur } : {}),
      pageSize: PAGE,
    }),
    [debounced, tags],
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(false); setRows([]); setCursor(""); setHasMore(false)
    listExercises(buildFilter(""))
      .then((d) => {
        if (!cancelled) { setRows(d.Exercises); setCursor(d.NextCursor); setHasMore(d.HasMore) }
      })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [buildFilter])

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || !cursor) return
    setLoadingMore(true)
    listExercises(buildFilter(cursor))
      .then((d) => {
        setRows((prev) => [...prev, ...d.Exercises])
        setCursor(d.NextCursor)
        setHasMore(d.HasMore)
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false))
  }, [hasMore, loadingMore, cursor, buildFilter])

  const loadMoreRef = useRef(loadMore)
  loadMoreRef.current = loadMore
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMoreRef.current() },
      { rootMargin: "200px" },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div className="frost-panel frost-in rounded-lg p-6">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("admin.ex.search")}
          className="max-w-sm"
        />
        <div className="min-w-64 max-w-md flex-1">
          <TagInput value={tags} onChange={setTags} placeholder={t("admin.ex.filterTags.placeholder")} />
        </div>
        {can("exercises.write") && (
          <Button onClick={() => setCreateOpen(true)}>{t("admin.ex.create.button")}</Button>
        )}
      </div>

      <CreateExerciseDialog open={createOpen} onOpenChange={setCreateOpen} />

      {error ? (
        <p className="py-8 text-center text-sm text-destructive">{t("admin.ex.loadError")}</p>
      ) : loading ? (
        <div className="flex justify-center py-8"><Spinner label={t("admin.loading")} /></div>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("admin.ex.empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-medium">{t("admin.ex.col.name")}</th>
                <th className="px-3 py-2 font-medium">{t("admin.ex.col.tags")}</th>
                <th className="px-3 py-2 font-medium">{t("admin.ex.col.status")}</th>
                <th className="px-3 py-2 font-medium">{t("admin.ex.col.updated")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.ID} className="border-b border-border/50 transition-colors hover:bg-accent/10">
                  <td className="px-3 py-2">
                    <Link href={`/exercises/detail?id=${item.ID}`} className="block">
                      <span className="font-medium text-foreground">{item.Name}</span>
                      {item.Description && (
                        <span className="block max-w-md truncate text-xs text-muted-foreground">{item.Description}</span>
                      )}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <span className="flex flex-wrap gap-1">
                      {item.Tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-secondary/40 px-2 py-0.5 text-xs">{tag}</span>
                      ))}
                    </span>
                  </td>
                  <td className="px-3 py-2"><StatusBadges item={item} /></td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {item.UpdatedAt ? new Date(item.UpdatedAt).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div ref={sentinelRef} className="h-6" />
      {loadingMore && <p className="py-2 text-center text-xs text-muted-foreground">{t("admin.ex.loadingMore")}</p>}
      {!loading && !hasMore && rows.length > 0 && (
        <p className="py-2 text-center text-xs text-muted-foreground">{t("admin.ex.endOfList")}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Добавить пункт «Завдання» в Sidebar**

В `src/components/shell/Sidebar.tsx`:

1) расширить импорт иконок:

```tsx
import { LayoutDashboard, Bell, Users, Puzzle, ChevronDown, ChevronRight } from "lucide-react"
```

2) в массив `SECTIONS` после секции users вставить:

```tsx
  { divider: true, items: [{ href: "/exercises", label: "admin.nav.exercises", icon: Puzzle, perm: "exercises.read" }] },
```

Ключ `admin.nav.exercises` уже есть в обоих каталогах («Exercises»/«Завдання»); `TITLES` в `AdminShell.tsx` уже содержит `/exercises`.

- [ ] **Step 6: Добавить i18n-ключи каталога**

В `messages/en.json`:

```json
  "admin.ex.search": "Search by name and description",
  "admin.ex.filterTags.placeholder": "Filter by tag…",
  "admin.ex.create.button": "Create exercise",
  "admin.ex.create.title": "New exercise",
  "admin.ex.create.description": "Name, description and tags. The content is edited in the draft.",
  "admin.ex.create.submit": "Create",
  "admin.ex.create.cancel": "Cancel",
  "admin.ex.field.name": "Name",
  "admin.ex.field.description": "Description",
  "admin.ex.field.tags": "Tags",
  "admin.ex.col.name": "Name",
  "admin.ex.col.tags": "Tags",
  "admin.ex.col.status": "Status",
  "admin.ex.col.updated": "Updated",
  "admin.ex.status.draft": "Draft",
  "admin.ex.status.published": "Published",
  "admin.ex.status.unpublished": "Unpublished",
  "admin.ex.empty": "No exercises yet",
  "admin.ex.loadError": "Failed to load exercises",
  "admin.ex.loadingMore": "Loading…",
  "admin.ex.endOfList": "End of list"
```

В `messages/uk.json`:

```json
  "admin.ex.search": "Пошук за назвою та описом",
  "admin.ex.filterTags.placeholder": "Фільтр за тегом…",
  "admin.ex.create.button": "Створити завдання",
  "admin.ex.create.title": "Нове завдання",
  "admin.ex.create.description": "Назва, опис і теги. Вміст редагується в чернетці.",
  "admin.ex.create.submit": "Створити",
  "admin.ex.create.cancel": "Скасувати",
  "admin.ex.field.name": "Назва",
  "admin.ex.field.description": "Опис",
  "admin.ex.field.tags": "Теги",
  "admin.ex.col.name": "Назва",
  "admin.ex.col.tags": "Теги",
  "admin.ex.col.status": "Статус",
  "admin.ex.col.updated": "Оновлено",
  "admin.ex.status.draft": "Чернетка",
  "admin.ex.status.published": "Опубліковано",
  "admin.ex.status.unpublished": "Знято з публікації",
  "admin.ex.empty": "Завдань поки немає",
  "admin.ex.loadError": "Не вдалося завантажити завдання",
  "admin.ex.loadingMore": "Завантаження…",
  "admin.ex.endOfList": "Кінець списку"
```

- [ ] **Step 7: Прогнать тест страницы — зелёный**

Run: `npx vitest run src/app/exercises/page.test.tsx`
Expected: PASS (4 теста). Пункт меню и переход create→detail — ручная проверка (jsdom-навигация не покрывается): `npm run dev`, зайти под админом на `/exercises`.

- [ ] **Step 8: Полная верификация и коммит**

Run: `npm run lint && npm run test`
Expected: PASS.

```bash
git add src/components/exercises/TagInput.tsx src/app/exercises/page.tsx src/app/exercises/page.test.tsx src/components/shell/Sidebar.tsx messages/en.json messages/uk.json
git commit -m "feat(admin): exercises catalog page with search, tag filter, create dialog, nav entry" -- src/components/exercises/TagInput.tsx src/app/exercises/page.tsx src/app/exercises/page.test.tsx src/components/shell/Sidebar.tsx messages/en.json messages/uk.json
git show --stat HEAD
```

---

### Task 4: Карточка задания — identity-форма + удаление

**Files:**
- Create: `src/app/exercises/detail/page.tsx`
- Create: `src/app/exercises/detail/page.test.tsx`
- Modify: `messages/en.json`, `messages/uk.json`

**Interfaces:**
- Consumes: `getExercise`, `updateExercise`, `deleteExercise`, `type Exercise` из `@/api/exercises/catalog`; `identitySchema`, `type IdentityFormValues` из `@/lib/exerciseSchemas`; `exerciseErrorMessage`, `exerciseErrorCode`, `ERR_EXERCISE_MODIFIED` из `@/lib/exerciseErrors`; `TagInput` из `@/components/exercises/TagInput`; ui `Form*`, `Dialog*`, `Alert`, `Button`, `Input`, `Spinner`; `useSearchParams` (в `<Suspense>`), `useRouter`.
- Produces: страница `/exercises/detail?id=`; внутренний компонент `Detail` содержит блок `{/* SECTION:VERSIONS */}` — точка вставки для Task 5; функция `load()` перечитывает exercise (Task 5 переиспользует после lifecycle-действий).

- [ ] **Step 1: Написать падающий тест**

`src/app/exercises/detail/page.test.tsx`:

```tsx
/**
 * page.test.tsx — карточка: загрузка identity, PATCH при сохранении,
 * 409 ErrExerciseModified → alert «оновіть сторінку».
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))
vi.mock('@/lib/useRole', () => ({
  useRole: () => ({ me: null, role: 'admin', isLoading: false, permissions: ['*'], can: () => true }),
}))
const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams('id=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'),
}))
vi.mock('@/api/exercises/catalog', () => ({
  getExercise: vi.fn(),
  updateExercise: vi.fn(),
  deleteExercise: vi.fn(),
}))
vi.mock('@/api/exercises/versions', () => ({
  listVersions: vi.fn().mockResolvedValue([]),
  publishDraft: vi.fn(),
  discardDraft: vi.fn(),
  rollbackToVersion: vi.fn(),
}))

import { ApiError } from '@/api/client'
import { getExercise, updateExercise } from '@/api/exercises/catalog'
import Page from './page'

const mockGet = vi.mocked(getExercise)
const mockUpdate = vi.mocked(updateExercise)

const EX_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const exercise = {
  ID: EX_ID,
  Name: 'SQLi basics',
  Description: 'Intro',
  Tags: ['web'],
  DraftVersionID: null,
  PublishedVersionID: null,
  CreatedAt: '2026-01-01T00:00:00Z',
  CreatedBy: null,
  UpdatedAt: '2026-01-02T00:00:00Z',
  UpdatedBy: null,
}

describe('exercise detail page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGet.mockResolvedValue(exercise)
  })

  it('loads the exercise into the identity form', async () => {
    render(<Page />)
    await waitFor(() => expect(screen.getByDisplayValue('SQLi basics')).toBeInTheDocument())
    expect(screen.getByDisplayValue('Intro')).toBeInTheDocument()
    expect(screen.getByText('web')).toBeInTheDocument()
  })

  it('PATCHes the identity on save', async () => {
    mockUpdate.mockResolvedValue({ ...exercise, Name: 'Renamed OK' })
    render(<Page />)
    await screen.findByDisplayValue('SQLi basics')
    fireEvent.change(screen.getByDisplayValue('SQLi basics'), { target: { value: 'Renamed OK' } })
    fireEvent.click(screen.getByText('admin.exDetail.identity.save'))
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(EX_ID, { Name: 'Renamed OK', Description: 'Intro', Tags: ['web'] }),
    )
  })

  it('shows the reload alert on 409 ErrExerciseModified', async () => {
    mockUpdate.mockRejectedValue(
      new ApiError(409, { Status: { Code: 70904, Message: 'modified' } }, 'modified'),
    )
    render(<Page />)
    await screen.findByDisplayValue('SQLi basics')
    fireEvent.click(screen.getByText('admin.exDetail.identity.save'))
    expect(await screen.findByText('admin.ex.err.modified')).toBeInTheDocument()
  })

  it('shows not-found state when the exercise is missing', async () => {
    mockGet.mockRejectedValue(new ApiError(404, { Status: { Code: 30901 } }, 'nf'))
    render(<Page />)
    expect(await screen.findByText('admin.exDetail.notFound')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Запустить тест — падает**

Run: `npx vitest run src/app/exercises/detail/page.test.tsx`
Expected: FAIL — «Cannot find module './page'» (файла нет).

- [ ] **Step 3: Реализовать `src/app/exercises/detail/page.tsx`**

Мок Task 4 уже мокает `@/api/exercises/versions` — импорты для Task 5 подключаем сразу, но UI-блок версий добавит Task 5.

```tsx
"use client"
import { Suspense, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { t } from "@/i18n/t"
import { useRole } from "@/lib/useRole"
import { getExercise, updateExercise, deleteExercise, type Exercise } from "@/api/exercises/catalog"
import { identitySchema, type IdentityFormValues } from "@/lib/exerciseSchemas"
import { exerciseErrorMessage } from "@/lib/exerciseErrors"
import { TagInput } from "@/components/exercises/TagInput"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog"
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from "@/components/ui/form"

function IdentityCard({ exercise, onSaved }: { exercise: Exercise; onSaved: () => void }) {
  const { can } = useRole()
  const readOnly = !can("exercises.write")
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const form = useForm<IdentityFormValues>({
    resolver: zodResolver(identitySchema),
    defaultValues: { Name: exercise.Name, Description: exercise.Description, Tags: exercise.Tags },
  })
  const busy = form.formState.isSubmitting

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null); setSaved(false)
    try {
      await updateExercise(exercise.ID, values)
      setSaved(true)
      onSaved()
    } catch (e) {
      setError(exerciseErrorMessage(e))
    }
  })

  return (
    <section className="frost-panel rounded-lg p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {t("admin.exDetail.identity.title")}
      </h2>
      <Form {...form}>
        <form onSubmit={onSubmit} className="max-w-xl space-y-3">
          <FormField control={form.control} name="Name" render={({ field }) => (
            <FormItem>
              <FormLabel>{t("admin.ex.field.name")}</FormLabel>
              <FormControl><Input {...field} disabled={busy || readOnly} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="Description" render={({ field }) => (
            <FormItem>
              <FormLabel>{t("admin.ex.field.description")}</FormLabel>
              <FormControl><Input {...field} disabled={busy || readOnly} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="Tags" render={({ field }) => (
            <FormItem>
              <FormLabel>{t("admin.ex.field.tags")}</FormLabel>
              <FormControl>
                <TagInput value={field.value} onChange={field.onChange} disabled={busy || readOnly} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          {saved && <p className="text-xs text-muted-foreground">{t("admin.exDetail.identity.saved")}</p>}
          {!readOnly && (
            <Button type="submit" disabled={busy}>{t("admin.exDetail.identity.save")}</Button>
          )}
        </form>
      </Form>
    </section>
  )
}

function DeleteCard({ exercise }: { exercise: Exercise }) {
  const router = useRouter()
  const { can } = useRole()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!can("exercises.delete")) return null

  async function remove() {
    setBusy(true); setError(null)
    try {
      await deleteExercise(exercise.ID)
      router.push("/exercises")
    } catch (e) {
      setError(exerciseErrorMessage(e))
      setBusy(false)
    }
  }

  return (
    <section className="frost-panel rounded-lg p-5">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="destructive" disabled={busy}>{t("admin.exDetail.delete.button")}</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.exDetail.delete.title")}</DialogTitle>
            <DialogDescription>{t("admin.exDetail.delete.body")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t("admin.exDetail.cancel")}</Button>
            </DialogClose>
            <Button variant="destructive" disabled={busy} onClick={remove}>
              {t("admin.exDetail.delete.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </section>
  )
}

function Detail() {
  const params = useSearchParams()
  const id = params.get("id") ?? ""

  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(() => {
    if (!id) { setNotFound(true); setLoading(false); return }
    setNotFound(false)
    getExercise(id)
      .then((e) => setExercise(e))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) {
    return <div className="flex justify-center py-12"><Spinner label={t("admin.loading")} /></div>
  }
  if (notFound || !exercise) {
    return (
      <div className="frost-panel frost-in rounded-lg p-8 text-center">
        <p className="text-muted-foreground">{t("admin.exDetail.notFound")}</p>
        <Link href="/exercises" className="mt-3 inline-block text-sm text-primary hover:underline">
          {t("admin.exDetail.back")}
        </Link>
      </div>
    )
  }

  return (
    <div className="frost-in space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/exercises" className="text-xs text-primary hover:underline">
            ← {t("admin.exDetail.back")}
          </Link>
          <h1 className="text-xl font-semibold text-foreground">{exercise.Name}</h1>
        </div>
      </div>

      {/* keyed remount: после reload формы получают свежие defaultValues */}
      <IdentityCard key={exercise.UpdatedAt} exercise={exercise} onSaved={load} />

      {/* SECTION:VERSIONS — Task 5 вставит сюда статус-блок и таблицу версий */}

      <DeleteCard exercise={exercise} />
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><Spinner label={t("admin.loading")} /></div>}>
      <Detail />
    </Suspense>
  )
}
```

- [ ] **Step 4: Добавить i18n-ключи карточки**

В `messages/en.json`:

```json
  "admin.exDetail.back": "Back to catalog",
  "admin.exDetail.notFound": "Exercise not found",
  "admin.exDetail.identity.title": "Details",
  "admin.exDetail.identity.save": "Save",
  "admin.exDetail.identity.saved": "Saved",
  "admin.exDetail.delete.button": "Delete exercise",
  "admin.exDetail.delete.title": "Delete the exercise?",
  "admin.exDetail.delete.body": "All versions of this exercise, including the published one, will be permanently deleted.",
  "admin.exDetail.delete.confirm": "Delete",
  "admin.exDetail.cancel": "Cancel"
```

В `messages/uk.json`:

```json
  "admin.exDetail.back": "Назад до каталогу",
  "admin.exDetail.notFound": "Завдання не знайдено",
  "admin.exDetail.identity.title": "Реквізити",
  "admin.exDetail.identity.save": "Зберегти",
  "admin.exDetail.identity.saved": "Збережено",
  "admin.exDetail.delete.button": "Видалити завдання",
  "admin.exDetail.delete.title": "Видалити завдання?",
  "admin.exDetail.delete.body": "Усі версії цього завдання, включно з опублікованою, буде видалено назавжди.",
  "admin.exDetail.delete.confirm": "Видалити",
  "admin.exDetail.cancel": "Скасувати"
```

- [ ] **Step 5: Прогнать тест — зелёный**

Run: `npx vitest run src/app/exercises/detail/page.test.tsx`
Expected: PASS (4 теста).

- [ ] **Step 6: Полная верификация и коммит**

Run: `npm run lint && npm run test`
Expected: PASS.

```bash
git add src/app/exercises/detail/page.tsx src/app/exercises/detail/page.test.tsx messages/en.json messages/uk.json
git commit -m "feat(admin): exercise detail page — identity form, optimistic-lock conflict alert, delete" -- src/app/exercises/detail/page.tsx src/app/exercises/detail/page.test.tsx messages/en.json messages/uk.json
git show --stat HEAD
```

---

### Task 5: Версии и lifecycle на карточке

**Files:**
- Create: `src/components/exercises/VersionsTable.tsx`
- Create: `src/components/exercises/VersionsTable.test.tsx`
- Modify: `src/app/exercises/detail/page.tsx` (статус-блок + версии + lifecycle-действия в `SECTION:VERSIONS`)
- Modify: `messages/en.json`, `messages/uk.json`

**Interfaces:**
- Consumes: `listVersions`, `publishDraft`, `discardDraft`, `rollbackToVersion`, `type VersionListItem` из `@/api/exercises/versions`; `type Exercise` (поля `DraftVersionID`/`PublishedVersionID`); `useUserNames` из `@/lib/userNames`; `exerciseErrorMessage`; точка вставки `{/* SECTION:VERSIONS */}` и `load()` из Task 4.
- Produces: `VersionsTable({ exerciseId: string; versions: VersionListItem[]; busy: boolean; onPublish: () => void; onDiscard: () => void; onRollback: (versionId: string) => void })` — кнопки уже отфильтрованы по `can()` внутри; действия подтверждает родитель (диалоги на странице).

- [ ] **Step 1: Написать падающий тест таблицы версий**

`src/components/exercises/VersionsTable.test.tsx`:

```tsx
/**
 * VersionsTable.test.tsx — строки версий, действия по статусу, резолв автора.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))
vi.mock('@/lib/useRole', () => ({
  useRole: () => ({ me: null, role: 'admin', isLoading: false, permissions: ['*'], can: () => true }),
}))
vi.mock('@/lib/userNames', () => ({
  useUserNames: () => ({
    u1: { id: 'u1', name: 'Ann Lee', href: '/users/detail?id=u1' },
  }),
}))

import { VersionsTable } from './VersionsTable'
import type { VersionListItem } from '@/api/exercises/versions'

const EX_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

function version(over: Partial<VersionListItem>): VersionListItem {
  return {
    ID: 'v1',
    Status: 'draft',
    AdminNote: 'note',
    VariantCount: 2,
    CreatedAt: '2026-01-01T00:00:00Z',
    CreatedBy: 'u1',
    PublishedAt: null,
    ...over,
  }
}

describe('VersionsTable', () => {
  const onPublish = vi.fn()
  const onDiscard = vi.fn()
  const onRollback = vi.fn()
  beforeEach(() => vi.clearAllMocks())

  function renderTable(versions: VersionListItem[]) {
    return render(
      <VersionsTable
        exerciseId={EX_ID}
        versions={versions}
        busy={false}
        onPublish={onPublish}
        onDiscard={onDiscard}
        onRollback={onRollback}
      />,
    )
  }

  it('draft row: edit link + publish + discard, author name resolved', () => {
    renderTable([version({ Status: 'draft' })])
    expect(screen.getByText('Ann Lee')).toBeInTheDocument()
    expect(screen.getByText('admin.exVersions.edit').closest('a'))
      .toHaveAttribute('href', `/exercises/draft?id=${EX_ID}`)
    fireEvent.click(screen.getByText('admin.exDetail.publish'))
    expect(onPublish).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByText('admin.exDetail.discard'))
    expect(onDiscard).toHaveBeenCalledOnce()
  })

  it('unpublished row: rollback + view link with versionId', () => {
    renderTable([version({ ID: 'v2', Status: 'unpublished', PublishedAt: '2026-01-05T00:00:00Z' })])
    fireEvent.click(screen.getByText('admin.exVersions.rollback'))
    expect(onRollback).toHaveBeenCalledWith('v2')
    expect(screen.getByText('admin.exVersions.view').closest('a'))
      .toHaveAttribute('href', `/exercises/draft?id=${EX_ID}&versionId=v2`)
  })

  it('published row: view only (no rollback/publish/discard)', () => {
    renderTable([version({ ID: 'v3', Status: 'published' })])
    expect(screen.queryByText('admin.exVersions.rollback')).not.toBeInTheDocument()
    expect(screen.queryByText('admin.exDetail.publish')).not.toBeInTheDocument()
    expect(screen.getByText('admin.exVersions.view')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Запустить тест — падает**

Run: `npx vitest run src/components/exercises/VersionsTable.test.tsx`
Expected: FAIL — «Cannot find module './VersionsTable'».

- [ ] **Step 3: Реализовать `src/components/exercises/VersionsTable.tsx`**

```tsx
"use client"

import Link from "next/link"
import { t } from "@/i18n/t"
import { useRole } from "@/lib/useRole"
import { useUserNames } from "@/lib/userNames"
import { Button } from "@/components/ui/button"
import type { VersionListItem } from "@/api/exercises/versions"

function StatusPill({ status }: { status: VersionListItem["Status"] }) {
  const cls =
    status === "published"
      ? "bg-primary/15 text-primary"
      : status === "draft"
        ? "bg-secondary/40 text-foreground"
        : "bg-muted text-muted-foreground"
  return <span className={`rounded-full px-2 py-0.5 text-xs ${cls}`}>{t(`admin.ex.status.${status}`)}</span>
}

/**
 * VersionsTable — история версий. Подтверждения (confirm-диалоги) живут у
 * родителя: колбэки вызываются по клику, страница открывает диалог.
 */
export function VersionsTable({
  exerciseId,
  versions,
  busy,
  onPublish,
  onDiscard,
  onRollback,
}: {
  exerciseId: string
  versions: VersionListItem[]
  busy: boolean
  onPublish: () => void
  onDiscard: () => void
  onRollback: (versionId: string) => void
}) {
  const { can } = useRole()
  const names = useUserNames(versions.map((v) => v.CreatedBy))

  if (versions.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">{t("admin.exVersions.empty")}</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            <th className="px-3 py-2 font-medium">{t("admin.exVersions.col.status")}</th>
            <th className="px-3 py-2 font-medium">{t("admin.exVersions.col.date")}</th>
            <th className="px-3 py-2 font-medium">{t("admin.exVersions.col.author")}</th>
            <th className="px-3 py-2 font-medium">{t("admin.exVersions.col.variants")}</th>
            <th className="px-3 py-2 font-medium">{t("admin.exVersions.col.note")}</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {versions.map((v) => {
            const author = v.CreatedBy ? names[v.CreatedBy] : undefined
            return (
              <tr key={v.ID} className="border-b border-border/50">
                <td className="px-3 py-2"><StatusPill status={v.Status} /></td>
                <td className="px-3 py-2 text-muted-foreground">
                  {new Date(v.PublishedAt ?? v.CreatedAt).toLocaleString()}
                </td>
                <td className="px-3 py-2">
                  {author ? (
                    <Link href={author.href} className="text-primary hover:underline">{author.name}</Link>
                  ) : (
                    <span className="text-muted-foreground">{v.CreatedBy ? v.CreatedBy.slice(0, 8) : "—"}</span>
                  )}
                </td>
                <td className="px-3 py-2">{v.VariantCount}</td>
                <td className="max-w-xs truncate px-3 py-2 text-muted-foreground">{v.AdminNote || "—"}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap justify-end gap-2">
                    {v.Status === "draft" && can("exercises.write") && (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/exercises/draft?id=${exerciseId}`}>{t("admin.exVersions.edit")}</Link>
                      </Button>
                    )}
                    {v.Status === "draft" && can("exercises.publish") && (
                      <>
                        <Button size="sm" disabled={busy} onClick={onPublish}>{t("admin.exDetail.publish")}</Button>
                        <Button variant="outline" size="sm" disabled={busy} onClick={onDiscard}>
                          {t("admin.exDetail.discard")}
                        </Button>
                      </>
                    )}
                    {v.Status === "unpublished" && can("exercises.publish") && (
                      <Button variant="outline" size="sm" disabled={busy} onClick={() => onRollback(v.ID)}>
                        {t("admin.exVersions.rollback")}
                      </Button>
                    )}
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/exercises/draft?id=${exerciseId}&versionId=${v.ID}`}>
                        {t("admin.exVersions.view")}
                      </Link>
                    </Button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: Встроить версии и lifecycle в `src/app/exercises/detail/page.tsx`**

4a. Дополнить импорты страницы:

```tsx
import {
  listVersions, publishDraft, discardDraft, rollbackToVersion, type VersionListItem,
} from "@/api/exercises/versions"
import { VersionsTable } from "@/components/exercises/VersionsTable"
```

4b. Добавить компонент `VersionsCard` (над `function Detail()`):

```tsx
type LifecycleAction =
  | { kind: "publish" }
  | { kind: "discard" }
  | { kind: "rollback"; versionId: string }

function VersionsCard({ exercise, onChanged }: { exercise: Exercise; onChanged: () => void }) {
  const { can } = useRole()
  const [versions, setVersions] = useState<VersionListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<LifecycleAction | null>(null)

  const loadVersions = useCallback(() => {
    setLoading(true)
    listVersions(exercise.ID)
      .then(setVersions)
      .catch(() => setError(t("admin.ex.loadError")))
      .finally(() => setLoading(false))
  }, [exercise.ID])

  useEffect(() => { loadVersions() }, [loadVersions])

  async function confirmPending() {
    if (!pending) return
    setBusy(true); setError(null)
    try {
      if (pending.kind === "publish") await publishDraft(exercise.ID)
      if (pending.kind === "discard") await discardDraft(exercise.ID)
      if (pending.kind === "rollback") await rollbackToVersion(exercise.ID, pending.versionId)
      setPending(null)
      loadVersions()
      onChanged()
    } catch (e) {
      // Ошибка publish (валидация топологии и т.п.) показывается блоком с расшифровкой.
      setError(exerciseErrorMessage(e))
      setPending(null)
    } finally {
      setBusy(false)
    }
  }

  const hasDraft = exercise.DraftVersionID !== null
  const hasPublished = exercise.PublishedVersionID !== null

  return (
    <section className="frost-panel rounded-lg p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {t("admin.exDetail.status.title")}
      </h2>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-sm">
          {hasDraft ? t("admin.exDetail.status.hasDraft") : t("admin.exDetail.status.noDraft")}
          {" · "}
          {hasPublished ? t("admin.exDetail.status.hasPublished") : t("admin.exDetail.status.noPublished")}
        </span>
        {can("exercises.write") && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/exercises/draft?id=${exercise.ID}`}>{t("admin.exDetail.editDraft")}</Link>
          </Button>
        )}
        {hasDraft && can("exercises.publish") && (
          <>
            <Button size="sm" disabled={busy} onClick={() => setPending({ kind: "publish" })}>
              {t("admin.exDetail.publish")}
            </Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => setPending({ kind: "discard" })}>
              {t("admin.exDetail.discard")}
            </Button>
          </>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="mb-3">
          <AlertDescription>
            <span className="font-medium">{t("admin.exDetail.publishError")}</span>: {error}
          </AlertDescription>
        </Alert>
      )}

      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {t("admin.exVersions.title")}
      </h3>
      {loading ? (
        <div className="flex justify-center py-6"><Spinner label={t("admin.loading")} /></div>
      ) : (
        <VersionsTable
          exerciseId={exercise.ID}
          versions={versions}
          busy={busy}
          onPublish={() => setPending({ kind: "publish" })}
          onDiscard={() => setPending({ kind: "discard" })}
          onRollback={(versionId) => setPending({ kind: "rollback", versionId })}
        />
      )}

      <Dialog open={pending !== null} onOpenChange={(open) => { if (!open) setPending(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pending?.kind === "publish" && t("admin.exDetail.publish.title")}
              {pending?.kind === "discard" && t("admin.exDetail.discard.title")}
              {pending?.kind === "rollback" && t("admin.exVersions.rollback.title")}
            </DialogTitle>
            <DialogDescription>
              {pending?.kind === "publish" && t("admin.exDetail.publish.body")}
              {pending?.kind === "discard" && t("admin.exDetail.discard.body")}
              {pending?.kind === "rollback" && t("admin.exVersions.rollback.body")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setPending(null)}>
              {t("admin.exDetail.cancel")}
            </Button>
            <Button disabled={busy} onClick={confirmPending}>
              {pending?.kind === "publish" && t("admin.exDetail.publish")}
              {pending?.kind === "discard" && t("admin.exDetail.discard")}
              {pending?.kind === "rollback" && t("admin.exVersions.rollback")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
```

4c. Заменить строку-маркер в `Detail`:

```tsx
      {/* SECTION:VERSIONS — Task 5 вставит сюда статус-блок и таблицу версий */}
```

на:

```tsx
      <VersionsCard exercise={exercise} onChanged={load} />
```

- [ ] **Step 5: Добавить i18n-ключи версий/lifecycle**

В `messages/en.json`:

```json
  "admin.exDetail.status.title": "State",
  "admin.exDetail.status.hasDraft": "Has a draft",
  "admin.exDetail.status.noDraft": "No draft",
  "admin.exDetail.status.hasPublished": "Published",
  "admin.exDetail.status.noPublished": "Not published",
  "admin.exDetail.editDraft": "Edit draft",
  "admin.exDetail.publish": "Publish",
  "admin.exDetail.publish.title": "Publish the draft?",
  "admin.exDetail.publish.body": "The draft passes full validation and becomes the active version.",
  "admin.exDetail.discard": "Discard draft",
  "admin.exDetail.discard.title": "Discard the draft?",
  "admin.exDetail.discard.body": "Unpublished draft changes will be lost.",
  "admin.exDetail.publishError": "Operation failed",
  "admin.exVersions.title": "Versions",
  "admin.exVersions.empty": "No versions yet",
  "admin.exVersions.col.status": "Status",
  "admin.exVersions.col.date": "Date",
  "admin.exVersions.col.author": "Author",
  "admin.exVersions.col.variants": "Variants",
  "admin.exVersions.col.note": "Note",
  "admin.exVersions.edit": "Edit",
  "admin.exVersions.view": "View",
  "admin.exVersions.rollback": "Roll back",
  "admin.exVersions.rollback.title": "Roll back to this version?",
  "admin.exVersions.rollback.body": "A new draft will be created from this version.",
```

В `messages/uk.json`:

```json
  "admin.exDetail.status.title": "Стан",
  "admin.exDetail.status.hasDraft": "Є чернетка",
  "admin.exDetail.status.noDraft": "Немає чернетки",
  "admin.exDetail.status.hasPublished": "Опубліковано",
  "admin.exDetail.status.noPublished": "Не опубліковано",
  "admin.exDetail.editDraft": "Редагувати чернетку",
  "admin.exDetail.publish": "Опублікувати",
  "admin.exDetail.publish.title": "Опублікувати чернетку?",
  "admin.exDetail.publish.body": "Чернетка пройде повну валідацію і стане активною версією.",
  "admin.exDetail.discard": "Відхилити чернетку",
  "admin.exDetail.discard.title": "Відхилити чернетку?",
  "admin.exDetail.discard.body": "Неопубліковані зміни чернетки буде втрачено.",
  "admin.exDetail.publishError": "Не вдалося виконати операцію",
  "admin.exVersions.title": "Версії",
  "admin.exVersions.empty": "Версій ще немає",
  "admin.exVersions.col.status": "Статус",
  "admin.exVersions.col.date": "Дата",
  "admin.exVersions.col.author": "Автор",
  "admin.exVersions.col.variants": "Варіанти",
  "admin.exVersions.col.note": "Нотатка",
  "admin.exVersions.edit": "Редагувати",
  "admin.exVersions.view": "Переглянути",
  "admin.exVersions.rollback": "Відкотитися",
  "admin.exVersions.rollback.title": "Відкотитися до цієї версії?",
  "admin.exVersions.rollback.body": "З цієї версії буде створено нову чернетку.",
```

- [ ] **Step 6: Прогнать тесты — зелёные**

Run: `npx vitest run src/components/exercises/VersionsTable.test.tsx src/app/exercises/detail/page.test.tsx`
Expected: PASS. Конфликт `ErrDraftAlreadyExists` при rollback (70906) проходит через `exerciseErrorMessage` → «У завдання вже є чернетка» — покрыт unit-тестом словаря (Task 1).

- [ ] **Step 7: Полная верификация и коммит**

Run: `npm run lint && npm run test`
Expected: PASS.

```bash
git add src/components/exercises/VersionsTable.tsx src/components/exercises/VersionsTable.test.tsx src/app/exercises/detail/page.tsx messages/en.json messages/uk.json
git commit -m "feat(admin): exercise versions table and publish/discard/rollback lifecycle" -- src/components/exercises/VersionsTable.tsx src/components/exercises/VersionsTable.test.tsx src/app/exercises/detail/page.tsx messages/en.json messages/uk.json
git show --stat HEAD
```

---

### Task 6: Каркас редактора — RHF-форма, табы вариантов, save, dirty-guard, read-only

**Files:**
- Modify: `src/lib/exerciseSchemas.ts` (сериализаторы `toDraftFormValues`/`toSaveDraftInput`)
- Modify: `src/lib/exerciseSchemas.test.ts` (тесты сериализации «форма → saveDraftRequest 1:1»)
- Create: `src/components/exercises/VariantTabs.tsx`
- Create: `src/app/exercises/draft/page.tsx`
- Create: `src/app/exercises/draft/page.test.tsx`
- Modify: `messages/en.json`, `messages/uk.json`

**Interfaces:**
- Consumes: `draftSchema`, form-типы и фабрики из Task 2; `getExercise` (Task 1); `getVersion`, `saveDraft`, типы `Version`, `SaveDraftInput`, `VariantDTO`, `TaskDTO`, `DeviceDTO`, `InterfaceDTO`, `TopologyDTO`, `PlaceholderDTO`, `Protocol` (Task 1); `exerciseErrorMessage`; ui `Form` (FormProvider), `Tabs*`, `Checkbox`, `Input`, `Button`, `Alert`, `Spinner`.
- Produces:
  - `toDraftFormValues(version: Version | null): DraftFormValues` и `toSaveDraftInput(values: DraftFormValues): SaveDraftInput` в `exerciseSchemas.ts`;
  - `VariantTabs({ disabled: boolean; renderVariant: (variantIndex: number) => React.ReactNode })` — владеет `useFieldArray("Variants")`, добавление/удаление вариантов, заголовки «Варіант {n}»;
  - страница `/exercises/draft?id=[&versionId=]`: FormProvider вокруг всей формы; `renderVariant` в Task 6 возвращает `<div className="space-y-6" data-variant-sections />` — Task 7 и Task 9 добавляют внутрь секции; переменная `disabled` (read-only режим `?versionId=` или нет `exercises.write`) пробрасывается всем секциям.

- [ ] **Step 1: Написать падающие тесты сериализации**

Добавить в КОНЕЦ `src/lib/exerciseSchemas.test.ts` (расширив import из `'./exerciseSchemas'` именами `toDraftFormValues`, `toSaveDraftInput` и добавив `import type { Version } from '@/api/exercises/versions'`):

```ts
// ── Сериализация формы ↔ версии ────────────────────────────────────────────────

const DEV_ID = '99999999-8888-7777-6666-555555555555'

function loadedVersion(): Version {
  return {
    ID: 'v1',
    ExerciseID: 'e1',
    Status: 'draft',
    AdminNote: 'wip',
    RegenerateFlagsOnPublish: true,
    CreatedAt: '2026-01-01T00:00:00Z',
    CreatedBy: null,
    PublishedAt: null,
    Variants: [{
      ID: 'var1',
      Index: 1,
      Tasks: [{
        ID: 'task1',
        Name: 'Find the flag',
        Description: { root: {} },
        Difficulty: 'medium',
        Flag: ['CTF{x}'],
        LinkedDeviceID: DEV_ID,
        DeviceFlagVar: 'FLAG',
        Attachments: [{ FileID: 'f1', Name: 'notes.pdf' }],
        Placeholders: [{ Kind: 'vpn.subnet' }],
      }],
      Topology: {
        VPN: { Enabled: true, DHCP: true },
        Internet: { Enabled: false, DHCP: false },
        Devices: [{
          ID: DEV_ID,
          Name: 'web',
          Type: 'container',
          Image: 'nginx:1.27',
          Interfaces: [{ Name: 'eth0', MAC: '', IP: { Type: 'static', Addresses: ['10.0.0.2/24'], Gateway: '10.0.0.1' } }],
          EnvVars: [{ Name: 'DB_PASS', Value: '', Secret: true, HasValue: true }],
          External: { Port: 8080, Protocol: 'https' },
        }],
        Connections: [{
          Endpoints: [
            { Kind: 'vpn', DeviceID: '', Interface: '' },
            { Kind: 'device', DeviceID: DEV_ID, Interface: 'eth0' },
          ],
        }],
      },
    }],
  }
}

describe('toDraftFormValues', () => {
  it('maps a loaded version into form values (External → Enabled-форма)', () => {
    const values = toDraftFormValues(loadedVersion())
    expect(values.AdminNote).toBe('wip')
    expect(values.RegenerateFlagsOnPublish).toBe(true)
    expect(values.Variants[0].ID).toBe('var1')
    expect(values.Variants[0].Tasks[0].ID).toBe('task1')
    expect(values.Variants[0].Topology.Devices[0].External)
      .toEqual({ Enabled: true, Port: 8080, Protocol: 'https' })
  })

  it('null version → пустой драфт (1 вариант, 1 задача)', () => {
    const values = toDraftFormValues(null)
    expect(values.Variants).toHaveLength(1)
    expect(values.Variants[0].Tasks).toHaveLength(1)
  })
})

describe('toSaveDraftInput', () => {
  it('round-trips a loaded version 1:1 (сохранённые ID уходят обратно)', () => {
    const input = toSaveDraftInput(toDraftFormValues(loadedVersion()))
    expect(input).toEqual({
      AdminNote: 'wip',
      RegenerateFlagsOnPublish: true,
      Variants: [{
        ID: 'var1',
        Index: 1,
        Tasks: [{
          ID: 'task1',
          Name: 'Find the flag',
          Description: { root: {} },
          Difficulty: 'medium',
          Flag: ['CTF{x}'],
          LinkedDeviceID: DEV_ID,
          DeviceFlagVar: 'FLAG',
          Attachments: [{ FileID: 'f1', Name: 'notes.pdf' }],
          Placeholders: [{ Kind: 'vpn.subnet' }],
        }],
        Topology: {
          VPN: { Enabled: true, DHCP: true },
          Internet: { Enabled: false, DHCP: false },
          Devices: [{
            ID: DEV_ID,
            Name: 'web',
            Type: 'container',
            Image: 'nginx:1.27',
            Interfaces: [{ Name: 'eth0', IP: { Type: 'static', Addresses: ['10.0.0.2/24'], Gateway: '10.0.0.1' } }],
            EnvVars: [{ Name: 'DB_PASS', Value: '', Secret: true }],
            External: { Port: 8080, Protocol: 'https' },
          }],
          Connections: [{
            Endpoints: [
              { Kind: 'vpn' },
              { Kind: 'device', DeviceID: DEV_ID, Interface: 'eth0' },
            ],
          }],
        },
      }],
    })
  })

  it('новые сущности уходят без ID (кроме устройств), Index перенумеровывается', () => {
    const draft = emptyDraft()
    draft.Variants[0].Tasks[0].Name = 'New task'
    const second = emptyVariant(99) // декоративный Index игнорируется
    second.Tasks[0].Name = 'New task'
    draft.Variants.push(second)
    const input = toSaveDraftInput(draft)
    expect(input.Variants[0].ID).toBeUndefined()
    expect(input.Variants[0].Tasks[0].ID).toBeUndefined()
    expect(input.Variants[0].Index).toBe(1)
    expect(input.Variants[1].Index).toBe(2)
  })

  it('свитч уходит «голым», выключенный External опускается, null Description опускается', () => {
    const draft = emptyDraft()
    draft.Variants[0].Tasks[0].Name = 'New task'
    const sw = emptyDevice()
    sw.Name = 'sw1'
    sw.Type = 'unmanaged-switch'
    sw.Interfaces = []
    const web = emptyDevice()
    web.Name = 'web'
    draft.Variants[0].Topology.Devices = [sw, web]
    const input = toSaveDraftInput(draft)
    const [swDTO, webDTO] = input.Variants[0].Topology.Devices!
    expect(swDTO).toEqual({ ID: sw.ID, Name: 'sw1', Type: 'unmanaged-switch' })
    expect(webDTO.External).toBeUndefined()
    expect(webDTO.Interfaces![0].MAC).toBeUndefined()
    expect(webDTO.Interfaces![0].IP).toEqual({ Type: 'dhcp' })
    expect(input.Variants[0].Tasks[0].Description).toBeUndefined()
    expect(input.Variants[0].Tasks[0].LinkedDeviceID).toBeUndefined()
  })
})
```

- [ ] **Step 2: Запустить — падает**

Run: `npx vitest run src/lib/exerciseSchemas.test.ts`
Expected: FAIL — `toDraftFormValues`/`toSaveDraftInput` не экспортируются.

- [ ] **Step 3: Добавить сериализаторы в `src/lib/exerciseSchemas.ts`**

Дополнить import типов из `@/api/exercises/versions`:

```ts
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
```

И добавить в конец файла:

```ts
// ── Сериализация: версия → форма → saveDraftRequest ────────────────────────────

/** Version (или null — чернетки ещё нет) → значения формы редактора. */
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
      // vpn.subnet / internet.subnet — только Kind
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
    Placeholders: (task.Placeholders as PlaceholderFormValues[]).map(placeholderToDTO),
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
  // ID устройства ВСЕГДА уходит (клиентский uuid для новых): на него ссылаются
  // Connections и LinkedDeviceID.
  const base: DeviceDTO = { ID: d.ID, Name: d.Name, Type: d.Type }
  if (d.Type === "unmanaged-switch" || d.Type === "hub") return base // свитч/хаб «голый»
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
    // VisualRender не пишем (зарезервирован под канвас)
  }
}

/** Значения формы → PUT /:id/draft (1:1, Index перенумеровывается по позиции). */
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
```

Run: `npx vitest run src/lib/exerciseSchemas.test.ts` → PASS.

- [ ] **Step 4: Написать падающий тест страницы редактора**

`src/app/exercises/draft/page.test.tsx`:

```tsx
/**
 * page.test.tsx — редактор чернетки: загрузка драфта, сохранение (PUT 1:1),
 * read-only режим версии (?versionId=).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))
vi.mock('@/lib/useRole', () => ({
  useRole: () => ({ me: null, role: 'admin', isLoading: false, permissions: ['*'], can: () => true }),
}))

let searchParams = new URLSearchParams('id=e1')
vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('@/api/exercises/catalog', () => ({ getExercise: vi.fn() }))
vi.mock('@/api/exercises/versions', () => ({
  getVersion: vi.fn(),
  saveDraft: vi.fn(),
}))

import { getExercise } from '@/api/exercises/catalog'
import { getVersion, saveDraft, type Version } from '@/api/exercises/versions'
import Page from './page'

const mockGetExercise = vi.mocked(getExercise)
const mockGetVersion = vi.mocked(getVersion)
const mockSaveDraft = vi.mocked(saveDraft)

const exercise = {
  ID: 'e1', Name: 'SQLi', Description: '', Tags: [],
  DraftVersionID: 'v1', PublishedVersionID: null,
  CreatedAt: '', CreatedBy: null, UpdatedAt: '', UpdatedBy: null,
}

const version: Version = {
  ID: 'v1', ExerciseID: 'e1', Status: 'draft', AdminNote: 'wip note',
  RegenerateFlagsOnPublish: false,
  CreatedAt: '2026-01-01T00:00:00Z', CreatedBy: null, PublishedAt: null,
  Variants: [{
    ID: 'var1', Index: 1,
    Tasks: [{
      ID: 't1', Name: 'Find the flag', Description: null, Difficulty: 'easy',
      Flag: [], LinkedDeviceID: '', DeviceFlagVar: '', Attachments: [], Placeholders: [],
    }],
    Topology: {
      VPN: { Enabled: false, DHCP: true }, Internet: { Enabled: false, DHCP: true },
      Devices: [], Connections: [],
    },
  }],
}

describe('draft editor page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    searchParams = new URLSearchParams('id=e1')
    mockGetExercise.mockResolvedValue(exercise)
    mockGetVersion.mockResolvedValue(version)
  })

  it('loads the existing draft into the form', async () => {
    render(<Page />)
    await waitFor(() => expect(screen.getByDisplayValue('wip note')).toBeInTheDocument())
    expect(mockGetVersion).toHaveBeenCalledWith('e1', 'v1')
    expect(screen.getByText('admin.exDraft.variant 1')).toBeInTheDocument()
  })

  it('starts from an empty draft when the exercise has none', async () => {
    mockGetExercise.mockResolvedValue({ ...exercise, DraftVersionID: null })
    render(<Page />)
    await waitFor(() => expect(screen.getByText('admin.exDraft.save')).toBeInTheDocument())
    expect(mockGetVersion).not.toHaveBeenCalled()
  })

  it('serializes the form 1:1 into saveDraft on submit', async () => {
    mockSaveDraft.mockResolvedValue(version)
    render(<Page />)
    await screen.findByDisplayValue('wip note')
    fireEvent.change(screen.getByDisplayValue('wip note'), { target: { value: 'updated note' } })
    fireEvent.click(screen.getByText('admin.exDraft.save'))
    await waitFor(() => expect(mockSaveDraft).toHaveBeenCalledOnce())
    const [exId, input] = mockSaveDraft.mock.calls[0]
    expect(exId).toBe('e1')
    expect(input.AdminNote).toBe('updated note')
    expect(input.Variants[0]).toMatchObject({ ID: 'var1', Index: 1 })
    expect(input.Variants[0].Tasks[0]).toMatchObject({ ID: 't1', Name: 'Find the flag' })
  })

  it('read-only mode (?versionId=) hides the save button and disables inputs', async () => {
    searchParams = new URLSearchParams('id=e1&versionId=v9')
    mockGetVersion.mockResolvedValue({ ...version, ID: 'v9', Status: 'unpublished' })
    render(<Page />)
    await waitFor(() => expect(mockGetVersion).toHaveBeenCalledWith('e1', 'v9'))
    expect(screen.queryByText('admin.exDraft.save')).not.toBeInTheDocument()
    expect(screen.getByText('admin.exDraft.readOnly')).toBeInTheDocument()
    expect(screen.getByDisplayValue('wip note')).toBeDisabled()
  })
})
```

- [ ] **Step 5: Запустить — падает**

Run: `npx vitest run src/app/exercises/draft/page.test.tsx`
Expected: FAIL — «Cannot find module './page'».

- [ ] **Step 6: Реализовать `src/components/exercises/VariantTabs.tsx`**

```tsx
"use client"

import { useState } from "react"
import { useFieldArray, useFormContext } from "react-hook-form"
import { Plus, Trash2 } from "lucide-react"
import { t } from "@/i18n/t"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { emptyVariant, type DraftFormValues } from "@/lib/exerciseSchemas"

/**
 * VariantTabs — табы вариантов поверх useFieldArray("Variants").
 * Заголовок таба — декоративный номер (позиция+1); идентичность варианта — ID.
 */
export function VariantTabs({
  disabled,
  renderVariant,
}: {
  disabled: boolean
  renderVariant: (variantIndex: number) => React.ReactNode
}) {
  const { control } = useFormContext<DraftFormValues>()
  const { fields, append, remove } = useFieldArray({ control, name: "Variants" })
  const [active, setActive] = useState("0")

  function addVariant() {
    append(emptyVariant(fields.length + 1))
    setActive(String(fields.length))
  }

  function removeActiveVariant() {
    remove(Number(active))
    setActive("0")
  }

  return (
    <Tabs value={active} onValueChange={setActive}>
      <div className="flex flex-wrap items-center gap-2">
        <TabsList>
          {fields.map((field, i) => (
            <TabsTrigger key={field.id} value={String(i)}>
              {t("admin.exDraft.variant").replace("{n}", String(i + 1))}
            </TabsTrigger>
          ))}
        </TabsList>
        {!disabled && (
          <>
            <Button type="button" variant="outline" size="sm" onClick={addVariant}>
              <Plus className="mr-1 h-4 w-4" />
              {t("admin.exDraft.addVariant")}
            </Button>
            {fields.length > 1 && (
              <Button type="button" variant="outline" size="sm" onClick={removeActiveVariant}>
                <Trash2 className="mr-1 h-4 w-4" />
                {t("admin.exDraft.removeVariant")}
              </Button>
            )}
          </>
        )}
      </div>
      {fields.map((field, i) => (
        <TabsContent key={field.id} value={String(i)}>
          {renderVariant(i)}
        </TabsContent>
      ))}
    </Tabs>
  )
}
```

- [ ] **Step 7: Реализовать `src/app/exercises/draft/page.tsx`**

```tsx
"use client"
import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { t } from "@/i18n/t"
import { useRole } from "@/lib/useRole"
import { getExercise } from "@/api/exercises/catalog"
import { getVersion, saveDraft, type Version } from "@/api/exercises/versions"
import {
  draftSchema, toDraftFormValues, toSaveDraftInput, type DraftFormValues,
} from "@/lib/exerciseSchemas"
import { exerciseErrorMessage } from "@/lib/exerciseErrors"
import { VariantTabs } from "@/components/exercises/VariantTabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { Form } from "@/components/ui/form"

function DraftEditor() {
  const params = useSearchParams()
  const exerciseId = params.get("id") ?? ""
  const versionId = params.get("versionId") ?? ""
  const readOnly = versionId !== ""
  const { can } = useRole()
  const disabled = readOnly || !can("exercises.write")

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const form = useForm<DraftFormValues>({
    resolver: zodResolver(draftSchema),
    defaultValues: toDraftFormValues(null),
    mode: "onBlur",
  })
  const { isDirty, isSubmitting } = form.formState

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!exerciseId) {
        setLoadError(true)
        setLoading(false)
        return
      }
      try {
        let version: Version | null = null
        if (versionId) {
          version = await getVersion(exerciseId, versionId)
        } else {
          const exercise = await getExercise(exerciseId)
          if (exercise.DraftVersionID) {
            version = await getVersion(exerciseId, exercise.DraftVersionID)
          }
        }
        if (!cancelled) form.reset(toDraftFormValues(version))
      } catch {
        if (!cancelled) setLoadError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
    // form стабильна между рендерами (useForm), эффект зависит только от параметров
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseId, versionId])

  // Dirty-guard: браузерное предупреждение при уходе с несохранёнными изменениями.
  useEffect(() => {
    if (!isDirty || readOnly) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [isDirty, readOnly])

  const onSubmit = form.handleSubmit(async (values) => {
    setSaveError(null)
    setSaved(false)
    try {
      const savedVersion = await saveDraft(exerciseId, toSaveDraftInput(values))
      form.reset(toDraftFormValues(savedVersion)) // сбрасывает isDirty, подтягивает серверные ID
      setSaved(true)
    } catch (e) {
      setSaveError(exerciseErrorMessage(e))
    }
  })

  if (loading) {
    return <div className="flex justify-center py-12"><Spinner label={t("admin.loading")} /></div>
  }
  if (loadError) {
    return (
      <div className="frost-panel frost-in rounded-lg p-8 text-center">
        <p className="text-muted-foreground">{t("admin.exDraft.loadError")}</p>
        <Link href="/exercises" className="mt-3 inline-block text-sm text-primary hover:underline">
          {t("admin.exDetail.back")}
        </Link>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="frost-in space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href={`/exercises/detail?id=${exerciseId}`} className="text-xs text-primary hover:underline">
              ← {t("admin.exDetail.back")}
            </Link>
            <h1 className="text-xl font-semibold text-foreground">
              {readOnly ? t("admin.exDraft.readOnly") : t("admin.exDraft.heading")}
            </h1>
          </div>
          {!readOnly && (
            <div className="flex items-center gap-3">
              {isDirty && <span className="text-xs text-muted-foreground">{t("admin.exDraft.unsaved")}</span>}
              {saved && !isDirty && <span className="text-xs text-muted-foreground">{t("admin.exDraft.savedNote")}</span>}
              <Button type="submit" disabled={disabled || isSubmitting}>
                {t("admin.exDraft.save")}
              </Button>
            </div>
          )}
        </div>

        {saveError && (
          <Alert variant="destructive"><AlertDescription>{saveError}</AlertDescription></Alert>
        )}

        {/* Секция «Налаштування»: AdminNote + RegenerateFlagsOnPublish (per-снапшот). */}
        <section className="frost-panel space-y-3 rounded-lg p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {t("admin.exDraft.settings.title")}
          </h2>
          <div className="max-w-xl space-y-3">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground" htmlFor="admin-note">
                {t("admin.exDraft.adminNote")}
              </label>
              <Input id="admin-note" {...form.register("AdminNote")} disabled={disabled} />
            </div>
            <Controller
              control={form.control}
              name="RegenerateFlagsOnPublish"
              render={({ field }) => (
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="regen-flags"
                    checked={field.value}
                    onCheckedChange={(v) => field.onChange(v === true)}
                    disabled={disabled}
                  />
                  <div>
                    <label htmlFor="regen-flags" className="text-sm text-foreground">
                      {t("admin.exDraft.regenFlags")}
                    </label>
                    <p className="text-xs text-muted-foreground">{t("admin.exDraft.regenFlags.hint")}</p>
                  </div>
                </div>
              )}
            />
          </div>
        </section>

        <section className="frost-panel rounded-lg p-5">
          <VariantTabs
            disabled={disabled}
            renderVariant={(variantIndex) => (
              <div className="space-y-6" data-variant-sections data-variant-index={variantIndex} />
            )}
          />
        </section>
      </form>
    </Form>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><Spinner label={t("admin.loading")} /></div>}>
      <DraftEditor />
    </Suspense>
  )
}
```

- [ ] **Step 8: Добавить i18n-ключи редактора**

В `messages/en.json`:

```json
  "admin.exDraft.heading": "Draft editor",
  "admin.exDraft.readOnly": "Version view (read-only)",
  "admin.exDraft.save": "Save draft",
  "admin.exDraft.savedNote": "Draft saved",
  "admin.exDraft.unsaved": "Unsaved changes",
  "admin.exDraft.loadError": "Failed to load the draft",
  "admin.exDraft.variant": "Variant {n}",
  "admin.exDraft.addVariant": "Add variant",
  "admin.exDraft.removeVariant": "Remove variant",
  "admin.exDraft.settings.title": "Settings",
  "admin.exDraft.adminNote": "Admin note",
  "admin.exDraft.regenFlags": "Regenerate flags on publish",
  "admin.exDraft.regenFlags.hint": "Fixed flag values are kept; random ones are regenerated on every publish.",
  "admin.exDraft.tasks.title": "Tasks",
  "admin.exDraft.topology.title": "Topology"
```

В `messages/uk.json`:

```json
  "admin.exDraft.heading": "Редактор чернетки",
  "admin.exDraft.readOnly": "Перегляд версії (тільки читання)",
  "admin.exDraft.save": "Зберегти чернетку",
  "admin.exDraft.savedNote": "Чернетку збережено",
  "admin.exDraft.unsaved": "Є незбережені зміни",
  "admin.exDraft.loadError": "Не вдалося завантажити чернетку",
  "admin.exDraft.variant": "Варіант {n}",
  "admin.exDraft.addVariant": "Додати варіант",
  "admin.exDraft.removeVariant": "Видалити варіант",
  "admin.exDraft.settings.title": "Налаштування",
  "admin.exDraft.adminNote": "Нотатка адміністратора",
  "admin.exDraft.regenFlags": "Перегенерувати прапорці під час публікації",
  "admin.exDraft.regenFlags.hint": "Фіксовані значення прапорців зберігаються; випадкові генеруються заново при кожній публікації.",
  "admin.exDraft.tasks.title": "Задачі",
  "admin.exDraft.topology.title": "Топологія"
```

- [ ] **Step 9: Прогнать тесты — зелёные**

Run: `npx vitest run src/app/exercises/draft/page.test.tsx src/lib/exerciseSchemas.test.ts`
Expected: PASS. Dirty-guard (`beforeunload`) — ручная проверка в браузере.

- [ ] **Step 10: Полная верификация и коммит**

Run: `npm run lint && npm run test`
Expected: PASS.

```bash
git add src/lib/exerciseSchemas.ts src/lib/exerciseSchemas.test.ts src/components/exercises/VariantTabs.tsx src/app/exercises/draft/page.tsx src/app/exercises/draft/page.test.tsx messages/en.json messages/uk.json
git commit -m "feat(admin): draft editor skeleton — RHF form, variant tabs, 1:1 serialization, read-only mode" -- src/lib/exerciseSchemas.ts src/lib/exerciseSchemas.test.ts src/components/exercises/VariantTabs.tsx src/app/exercises/draft/page.tsx src/app/exercises/draft/page.test.tsx messages/en.json messages/uk.json
git show --stat HEAD
```

---

### Task 7: Задачи — TaskAccordion + TaskForm + Lexical + FlagInput + PlaceholderList

**Files:**
- Create: `src/components/exercises/FlagInput.tsx`
- Create: `src/components/exercises/FlagInput.test.tsx`
- Create: `src/components/exercises/PlaceholderList.tsx`
- Create: `src/components/exercises/PlaceholderList.test.tsx`
- Create: `src/components/exercises/TaskForm.tsx`
- Create: `src/components/exercises/TaskAccordion.tsx`
- Modify: `src/app/exercises/draft/page.tsx` (вставить `TaskAccordion` в `renderVariant`)
- Modify: `messages/en.json`, `messages/uk.json`

**Interfaces:**
- Consumes: `DraftFormValues`, `emptyTask`, `emptyPlaceholder`, `type PlaceholderFormValues` из `@/lib/exerciseSchemas`; `RichTextEditor` (default export из `@/components/notifications/editor/RichTextEditor`, контракт `value: LexicalState | null`, `onChange(state)`); `useFormContext`/`useFieldArray`/`useWatch`/`Controller`; ui `Input`, `Button`, `Checkbox`, `SelectMenu`, `Form*`.
- Produces:
  - `FlagInput({ value: string[]; onChange: (v: string[]) => void; disabled?: boolean })` — controlled, подпись семантики 0/1/N;
  - `PlaceholderList({ variantIndex: number; taskIndex: number; disabled: boolean })`;
  - `TaskForm({ variantIndex: number; taskIndex: number; disabled: boolean })` — содержит маркер `{/* SECTION:ATTACHMENTS */}` (Task 8 заменит на `AttachmentList`);
  - `TaskAccordion({ variantIndex: number; disabled: boolean })`.

- [ ] **Step 1: Написать падающие тесты FlagInput и PlaceholderList**

`src/components/exercises/FlagInput.test.tsx`:

```tsx
/**
 * FlagInput.test.tsx — семантика 0/1/N значений прапорца.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))

import { FlagInput } from './FlagInput'

describe('FlagInput', () => {
  const onChange = vi.fn()
  beforeEach(() => vi.clearAllMocks())

  it('0 значень → підпис «випадковий прапорець»', () => {
    render(<FlagInput value={[]} onChange={onChange} />)
    expect(screen.getByText('admin.exTask.flag.semantics0')).toBeInTheDocument()
  })

  it('1 значення → підпис «фіксований»', () => {
    render(<FlagInput value={['CTF{x}']} onChange={onChange} />)
    expect(screen.getByText('admin.exTask.flag.semantics1')).toBeInTheDocument()
    expect(screen.getByDisplayValue('CTF{x}')).toBeInTheDocument()
  })

  it('N значень → підпис «випадковий вибір»', () => {
    render(<FlagInput value={['a', 'b']} onChange={onChange} />)
    expect(screen.getByText('admin.exTask.flag.semanticsN')).toBeInTheDocument()
  })

  it('додає порожнє значення кнопкою', () => {
    render(<FlagInput value={['a']} onChange={onChange} />)
    fireEvent.click(screen.getByText('admin.exTask.flag.add'))
    expect(onChange).toHaveBeenCalledWith(['a', ''])
  })

  it('редагує та видаляє значення', () => {
    render(<FlagInput value={['a', 'b']} onChange={onChange} />)
    fireEvent.change(screen.getByDisplayValue('a'), { target: { value: 'aa' } })
    expect(onChange).toHaveBeenCalledWith(['aa', 'b'])
    fireEvent.click(screen.getByLabelText('remove-flag-1'))
    expect(onChange).toHaveBeenCalledWith(['a'])
  })

  it('disabled ховає кнопки', () => {
    render(<FlagInput value={['a']} onChange={onChange} disabled />)
    expect(screen.queryByText('admin.exTask.flag.add')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('remove-flag-0')).not.toBeInTheDocument()
  })
})
```

`src/components/exercises/PlaceholderList.test.tsx` — рендерим внутри реальной RHF-формы:

```tsx
/**
 * PlaceholderList.test.tsx — поля зависят от Kind (ip / external.link / *.subnet).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useForm, FormProvider } from 'react-hook-form'

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))

import { PlaceholderList } from './PlaceholderList'
import { emptyDraft, type DraftFormValues, type PlaceholderFormValues } from '@/lib/exerciseSchemas'

function Harness({ placeholders, devices }: {
  placeholders: PlaceholderFormValues[]
  devices?: { withExternal: boolean }
}) {
  const draft = emptyDraft()
  draft.Variants[0].Tasks[0].Placeholders = placeholders
  if (devices) {
    draft.Variants[0].Topology.Devices = [{
      ID: 'd1', Name: 'web', Type: 'container', Image: '', Interfaces: [], EnvVars: [],
      External: { Enabled: devices.withExternal, Port: 80, Protocol: 'http' },
    }]
  }
  const form = useForm<DraftFormValues>({ defaultValues: draft })
  return (
    <FormProvider {...form}>
      <PlaceholderList variantIndex={0} taskIndex={0} disabled={false} />
    </FormProvider>
  )
}

const base: PlaceholderFormValues = {
  Kind: 'ip', IPReference: 'vpn', Octets1to3: '', LastOctet: 5, ShowMask: false, DeviceName: '',
}

describe('PlaceholderList', () => {
  it('kind=ip: показує IPReference і LastOctet, Octets1to3 лише для static', () => {
    render(<Harness placeholders={[base]} />)
    expect(screen.getByText('admin.exPh.ipref')).toBeInTheDocument()
    expect(screen.getByText('admin.exPh.lastOctet')).toBeInTheDocument()
    expect(screen.queryByText('admin.exPh.octets')).not.toBeInTheDocument()
  })

  it('kind=ip + IPReference=static: показує Octets1to3', () => {
    render(<Harness placeholders={[{ ...base, IPReference: 'static', Octets1to3: '10.0.0' }]} />)
    expect(screen.getByText('admin.exPh.octets')).toBeInTheDocument()
  })

  it('kind=external.link: показує вибір пристрою', () => {
    render(
      <Harness
        placeholders={[{ ...base, Kind: 'external.link', DeviceName: '' }]}
        devices={{ withExternal: true }}
      />,
    )
    expect(screen.getByText('admin.exPh.device')).toBeInTheDocument()
  })

  it('kind=vpn.subnet: додаткових полів немає', () => {
    render(<Harness placeholders={[{ ...base, Kind: 'vpn.subnet' }]} />)
    expect(screen.queryByText('admin.exPh.ipref')).not.toBeInTheDocument()
    expect(screen.queryByText('admin.exPh.device')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Запустить — падают**

Run: `npx vitest run src/components/exercises/FlagInput.test.tsx src/components/exercises/PlaceholderList.test.tsx`
Expected: FAIL — «Cannot find module».

- [ ] **Step 3: Реализовать `src/components/exercises/FlagInput.tsx`**

```tsx
"use client"

import { Plus, Trash2 } from "lucide-react"
import { t } from "@/i18n/t"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

/**
 * FlagInput — список значений прапорца задачи.
 * Семантика: [] → случайный при развёртывании; 1 → фиксированный;
 * N → случайный выбор из списка при развёртывании.
 */
export function FlagInput({
  value,
  onChange,
  disabled,
}: {
  value: string[]
  onChange: (v: string[]) => void
  disabled?: boolean
}) {
  const semanticsKey =
    value.length === 0
      ? "admin.exTask.flag.semantics0"
      : value.length === 1
        ? "admin.exTask.flag.semantics1"
        : "admin.exTask.flag.semanticsN"

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{t("admin.exTask.flag.title")}</span>
        {!disabled && (
          <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, ""])}>
            <Plus className="mr-1 h-4 w-4" />
            {t("admin.exTask.flag.add")}
          </Button>
        )}
      </div>
      {value.map((flag, i) => (
        // Индекс как key: список короткий, элементы редактируются на месте
        <div key={i} className="flex items-center gap-2">
          <Input
            value={flag}
            disabled={disabled}
            onChange={(e) => onChange(value.map((v, j) => (j === i ? e.target.value : v)))}
          />
          {!disabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={`remove-flag-${i}`}
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
      <p className="text-xs text-muted-foreground">{t(semanticsKey)}</p>
    </div>
  )
}
```

- [ ] **Step 4: Реализовать `src/components/exercises/PlaceholderList.tsx`**

```tsx
"use client"

import { Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form"
import { Plus, Trash2 } from "lucide-react"
import { t } from "@/i18n/t"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { SelectMenu } from "@/components/ui/select-menu"
import { emptyPlaceholder, type DraftFormValues } from "@/lib/exerciseSchemas"

const KIND_OPTIONS = [
  { value: "vpn.subnet", labelKey: "admin.exPh.kind.vpnSubnet" },
  { value: "internet.subnet", labelKey: "admin.exPh.kind.internetSubnet" },
  { value: "ip", labelKey: "admin.exPh.kind.ip" },
  { value: "external.link", labelKey: "admin.exPh.kind.externalLink" },
]

const IPREF_OPTIONS = [
  { value: "vpn", labelKey: "admin.exPh.ipref.vpn" },
  { value: "internet", labelKey: "admin.exPh.ipref.internet" },
  { value: "static", labelKey: "admin.exPh.ipref.static" },
]

/**
 * PlaceholderList — структурированные плейсхолдеры описания задачи.
 * Поля строки зависят от Kind; валидируются против топологии при publish (бэкенд).
 */
export function PlaceholderList({
  variantIndex,
  taskIndex,
  disabled,
}: {
  variantIndex: number
  taskIndex: number
  disabled: boolean
}) {
  const { control } = useFormContext<DraftFormValues>()
  const name = `Variants.${variantIndex}.Tasks.${taskIndex}.Placeholders` as const
  const { fields, append, remove } = useFieldArray({ control, name })
  const rows = useWatch({ control, name }) ?? []
  const devices = useWatch({ control, name: `Variants.${variantIndex}.Topology.Devices` }) ?? []
  const externalDeviceNames = devices
    .filter((d) => d.External?.Enabled && d.Name)
    .map((d) => d.Name)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{t("admin.exPh.title")}</span>
        {!disabled && (
          <Button type="button" variant="outline" size="sm" onClick={() => append(emptyPlaceholder())}>
            <Plus className="mr-1 h-4 w-4" />
            {t("admin.exPh.add")}
          </Button>
        )}
      </div>

      {fields.map((field, pi) => {
        const kind = rows[pi]?.Kind
        const ipRef = rows[pi]?.IPReference
        return (
          <div key={field.id} className="space-y-2 rounded-md border border-border p-3">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <span className="mb-1 block text-xs text-muted-foreground">{t("admin.exPh.kind")}</span>
                <Controller
                  control={control}
                  name={`${name}.${pi}.Kind`}
                  render={({ field: kindField }) => (
                    <SelectMenu
                      value={kindField.value}
                      onChange={kindField.onChange}
                      disabled={disabled}
                      options={KIND_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                      className="w-full"
                    />
                  )}
                />
              </div>
              {!disabled && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`remove-placeholder-${pi}`}
                  onClick={() => remove(pi)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            {kind === "ip" && (
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <span className="mb-1 block text-xs text-muted-foreground">{t("admin.exPh.ipref")}</span>
                  <Controller
                    control={control}
                    name={`${name}.${pi}.IPReference`}
                    render={({ field: refField }) => (
                      <SelectMenu
                        value={refField.value}
                        onChange={refField.onChange}
                        disabled={disabled}
                        options={IPREF_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                        className="w-full"
                      />
                    )}
                  />
                </div>
                <div>
                  <span className="mb-1 block text-xs text-muted-foreground">{t("admin.exPh.lastOctet")}</span>
                  <Controller
                    control={control}
                    name={`${name}.${pi}.LastOctet`}
                    render={({ field: octetField }) => (
                      <Input
                        type="number"
                        min={0}
                        max={255}
                        value={octetField.value}
                        disabled={disabled}
                        onChange={(e) => octetField.onChange(Number(e.target.value))}
                      />
                    )}
                  />
                </div>
                {ipRef === "static" && (
                  <div>
                    <span className="mb-1 block text-xs text-muted-foreground">{t("admin.exPh.octets")}</span>
                    <Controller
                      control={control}
                      name={`${name}.${pi}.Octets1to3`}
                      render={({ field: octetsField }) => (
                        <Input placeholder="10.0.0" value={octetsField.value} disabled={disabled}
                          onChange={octetsField.onChange} />
                      )}
                    />
                  </div>
                )}
                <div className="flex items-end gap-2 pb-1">
                  <Controller
                    control={control}
                    name={`${name}.${pi}.ShowMask`}
                    render={({ field: maskField }) => (
                      <>
                        <Checkbox
                          id={`ph-mask-${variantIndex}-${taskIndex}-${pi}`}
                          checked={maskField.value}
                          onCheckedChange={(v) => maskField.onChange(v === true)}
                          disabled={disabled}
                        />
                        <label htmlFor={`ph-mask-${variantIndex}-${taskIndex}-${pi}`} className="text-xs">
                          {t("admin.exPh.showMask")}
                        </label>
                      </>
                    )}
                  />
                </div>
              </div>
            )}

            {kind === "external.link" && (
              <div>
                <span className="mb-1 block text-xs text-muted-foreground">{t("admin.exPh.device")}</span>
                <Controller
                  control={control}
                  name={`${name}.${pi}.DeviceName`}
                  render={({ field: devField }) => (
                    <SelectMenu
                      value={devField.value}
                      onChange={devField.onChange}
                      disabled={disabled}
                      placeholder={t("admin.exPh.device.placeholder")}
                      options={externalDeviceNames.map((n) => ({ value: n, label: n }))}
                      className="w-full"
                    />
                  )}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5: Реализовать `src/components/exercises/TaskForm.tsx`**

```tsx
"use client"

import { Controller, useFormContext, useWatch } from "react-hook-form"
import { t } from "@/i18n/t"
import { Input } from "@/components/ui/input"
import { SelectMenu } from "@/components/ui/select-menu"
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import RichTextEditor from "@/components/notifications/editor/RichTextEditor"
import { FlagInput } from "./FlagInput"
import { PlaceholderList } from "./PlaceholderList"
import type { DraftFormValues } from "@/lib/exerciseSchemas"

const DIFFICULTIES = ["trivial", "easy", "medium", "hard", "insane"] as const

/** TaskForm — поля одной задачи варианта (внутри аккордеона). */
export function TaskForm({
  variantIndex,
  taskIndex,
  disabled,
}: {
  variantIndex: number
  taskIndex: number
  disabled: boolean
}) {
  const { control } = useFormContext<DraftFormValues>()
  const base = `Variants.${variantIndex}.Tasks.${taskIndex}` as const
  // Привязка прапорца — только к устройствам ТОПОЛОГИИ ТЕКУЩЕГО варианта.
  const devices = useWatch({ control, name: `Variants.${variantIndex}.Topology.Devices` }) ?? []
  const linkable = devices.filter((d) => d.Type === "container" || d.Type === "vm")

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField control={control} name={`${base}.Name`} render={({ field }) => (
          <FormItem>
            <FormLabel>{t("admin.exTask.name")}</FormLabel>
            <FormControl><Input {...field} disabled={disabled} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={control} name={`${base}.Difficulty`} render={({ field }) => (
          <FormItem>
            <FormLabel>{t("admin.exTask.difficulty")}</FormLabel>
            <FormControl>
              <SelectMenu
                value={field.value}
                onChange={field.onChange}
                disabled={disabled}
                options={DIFFICULTIES.map((d) => ({ value: d, label: t(`admin.ex.difficulty.${d}`) }))}
                className="w-full"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </div>

      <div>
        <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
          {t("admin.exTask.description")}
        </span>
        {/* Lexical — controlled-исключение: JSON-стейт в поле формы через Controller */}
        <Controller
          control={control}
          name={`${base}.Description`}
          render={({ field }) => (
            <RichTextEditor value={field.value} onChange={field.onChange} disabled={disabled} />
          )}
        />
      </div>

      <Controller
        control={control}
        name={`${base}.Flag`}
        render={({ field }) => (
          <FlagInput value={field.value} onChange={field.onChange} disabled={disabled} />
        )}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField control={control} name={`${base}.LinkedDeviceID`} render={({ field }) => (
          <FormItem>
            <FormLabel>{t("admin.exTask.linkedDevice")}</FormLabel>
            <FormControl>
              <SelectMenu
                value={field.value}
                onChange={field.onChange}
                disabled={disabled}
                options={[
                  { value: "", label: t("admin.exTask.linkedDevice.none") },
                  ...linkable.map((d) => ({ value: d.ID, label: d.Name || d.ID.slice(0, 8) })),
                ]}
                className="w-full"
              />
            </FormControl>
          </FormItem>
        )} />
        <FormField control={control} name={`${base}.DeviceFlagVar`} render={({ field }) => (
          <FormItem>
            <FormLabel>{t("admin.exTask.deviceFlagVar")}</FormLabel>
            <FormControl><Input {...field} disabled={disabled} placeholder="FLAG" /></FormControl>
          </FormItem>
        )} />
      </div>

      {/* SECTION:ATTACHMENTS — Task 8 заменит на <AttachmentList .../> */}

      <PlaceholderList variantIndex={variantIndex} taskIndex={taskIndex} disabled={disabled} />
    </div>
  )
}
```

- [ ] **Step 6: Реализовать `src/components/exercises/TaskAccordion.tsx`**

```tsx
"use client"

import { useState } from "react"
import { useFieldArray, useFormContext, useWatch } from "react-hook-form"
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react"
import { t } from "@/i18n/t"
import { Button } from "@/components/ui/button"
import { emptyTask, type DraftFormValues } from "@/lib/exerciseSchemas"
import { TaskForm } from "./TaskForm"

/** TaskAccordion — задачи варианта: аккордеон + add/remove. */
export function TaskAccordion({
  variantIndex,
  disabled,
}: {
  variantIndex: number
  disabled: boolean
}) {
  const { control } = useFormContext<DraftFormValues>()
  const name = `Variants.${variantIndex}.Tasks` as const
  const { fields, append, remove } = useFieldArray({ control, name })
  const [open, setOpen] = useState<number | null>(0)
  const rows = useWatch({ control, name }) ?? []

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t("admin.exDraft.tasks.title")}
        </h3>
        {!disabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => { append(emptyTask()); setOpen(fields.length) }}
          >
            <Plus className="mr-1 h-4 w-4" />
            {t("admin.exTask.add")}
          </Button>
        )}
      </div>

      {fields.map((field, ti) => (
        <div key={field.id} className="rounded-md border border-border">
          <button
            type="button"
            className="flex w-full items-center justify-between px-3 py-2 text-sm"
            onClick={() => setOpen(open === ti ? null : ti)}
          >
            <span className="font-medium">
              {rows[ti]?.Name || `${t("admin.exTask.untitled")} ${ti + 1}`}
            </span>
            {open === ti ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          {open === ti && (
            <div className="space-y-3 border-t border-border p-3">
              <TaskForm variantIndex={variantIndex} taskIndex={ti} disabled={disabled} />
              {!disabled && (
                <Button type="button" variant="destructive" size="sm" onClick={() => { remove(ti); setOpen(null) }}>
                  <Trash2 className="mr-1 h-4 w-4" />
                  {t("admin.exTask.remove")}
                </Button>
              )}
            </div>
          )}
        </div>
      ))}
    </section>
  )
}
```

- [ ] **Step 7: Вставить TaskAccordion в редактор**

В `src/app/exercises/draft/page.tsx`:

1) добавить импорт:

```tsx
import { TaskAccordion } from "@/components/exercises/TaskAccordion"
```

2) заменить

```tsx
            renderVariant={(variantIndex) => (
              <div className="space-y-6" data-variant-sections data-variant-index={variantIndex} />
            )}
```

на

```tsx
            renderVariant={(variantIndex) => (
              <div className="space-y-6" data-variant-sections data-variant-index={variantIndex}>
                <TaskAccordion variantIndex={variantIndex} disabled={disabled} />
              </div>
            )}
```

- [ ] **Step 8: Добавить i18n-ключи задач**

В `messages/en.json`:

```json
  "admin.exTask.add": "Add task",
  "admin.exTask.remove": "Remove task",
  "admin.exTask.untitled": "Task",
  "admin.exTask.name": "Name",
  "admin.exTask.difficulty": "Difficulty",
  "admin.ex.difficulty.trivial": "Trivial",
  "admin.ex.difficulty.easy": "Easy",
  "admin.ex.difficulty.medium": "Medium",
  "admin.ex.difficulty.hard": "Hard",
  "admin.ex.difficulty.insane": "Insane",
  "admin.exTask.description": "Description",
  "admin.exTask.flag.title": "Flag",
  "admin.exTask.flag.add": "Add value",
  "admin.exTask.flag.semantics0": "No values — a random flag is generated at deploy time",
  "admin.exTask.flag.semantics1": "One value — a fixed flag",
  "admin.exTask.flag.semanticsN": "Several values — one is picked at random at deploy time",
  "admin.exTask.linkedDevice": "Flag device",
  "admin.exTask.linkedDevice.none": "— not linked —",
  "admin.exTask.deviceFlagVar": "Flag env variable",
  "admin.exPh.title": "Placeholders",
  "admin.exPh.add": "Add placeholder",
  "admin.exPh.kind": "Kind",
  "admin.exPh.kind.vpnSubnet": "VPN subnet",
  "admin.exPh.kind.internetSubnet": "Internet subnet",
  "admin.exPh.kind.ip": "IP address",
  "admin.exPh.kind.externalLink": "External link",
  "admin.exPh.ipref": "IP source",
  "admin.exPh.ipref.vpn": "VPN",
  "admin.exPh.ipref.internet": "Internet",
  "admin.exPh.ipref.static": "Static octets",
  "admin.exPh.octets": "Octets 1–3",
  "admin.exPh.lastOctet": "Last octet",
  "admin.exPh.showMask": "Show mask",
  "admin.exPh.device": "Device",
  "admin.exPh.device.placeholder": "Choose a device…"
```

В `messages/uk.json`:

```json
  "admin.exTask.add": "Додати задачу",
  "admin.exTask.remove": "Видалити задачу",
  "admin.exTask.untitled": "Задача",
  "admin.exTask.name": "Назва",
  "admin.exTask.difficulty": "Складність",
  "admin.ex.difficulty.trivial": "Тривіальна",
  "admin.ex.difficulty.easy": "Легка",
  "admin.ex.difficulty.medium": "Середня",
  "admin.ex.difficulty.hard": "Складна",
  "admin.ex.difficulty.insane": "Божевільна",
  "admin.exTask.description": "Опис",
  "admin.exTask.flag.title": "Прапорець",
  "admin.exTask.flag.add": "Додати значення",
  "admin.exTask.flag.semantics0": "Без значень — випадковий прапорець генерується під час розгортання",
  "admin.exTask.flag.semantics1": "Одне значення — фіксований прапорець",
  "admin.exTask.flag.semanticsN": "Кілька значень — одне обирається випадково під час розгортання",
  "admin.exTask.linkedDevice": "Пристрій прапорця",
  "admin.exTask.linkedDevice.none": "— не привʼязано —",
  "admin.exTask.deviceFlagVar": "Змінна оточення прапорця",
  "admin.exPh.title": "Плейсхолдери",
  "admin.exPh.add": "Додати плейсхолдер",
  "admin.exPh.kind": "Тип",
  "admin.exPh.kind.vpnSubnet": "Підмережа VPN",
  "admin.exPh.kind.internetSubnet": "Підмережа Інтернет",
  "admin.exPh.kind.ip": "IP-адреса",
  "admin.exPh.kind.externalLink": "Зовнішнє посилання",
  "admin.exPh.ipref": "Джерело IP",
  "admin.exPh.ipref.vpn": "VPN",
  "admin.exPh.ipref.internet": "Інтернет",
  "admin.exPh.ipref.static": "Статичні октети",
  "admin.exPh.octets": "Октети 1–3",
  "admin.exPh.lastOctet": "Останній октет",
  "admin.exPh.showMask": "Показувати маску",
  "admin.exPh.device": "Пристрій",
  "admin.exPh.device.placeholder": "Оберіть пристрій…"
```

- [ ] **Step 9: Прогнать тесты — зелёные**

Run: `npx vitest run src/components/exercises/FlagInput.test.tsx src/components/exercises/PlaceholderList.test.tsx src/app/exercises/draft/page.test.tsx`
Expected: PASS, включая перезапуск теста редактора (теперь он рендерит TaskAccordion + Lexical в jsdom).

- [ ] **Step 10: Полная верификация и коммит**

Run: `npm run lint && npm run test`
Expected: PASS.

```bash
git add src/components/exercises/FlagInput.tsx src/components/exercises/FlagInput.test.tsx src/components/exercises/PlaceholderList.tsx src/components/exercises/PlaceholderList.test.tsx src/components/exercises/TaskForm.tsx src/components/exercises/TaskAccordion.tsx src/app/exercises/draft/page.tsx messages/en.json messages/uk.json
git commit -m "feat(admin): draft editor tasks — accordion, Lexical description, flags, placeholders" -- src/components/exercises/FlagInput.tsx src/components/exercises/FlagInput.test.tsx src/components/exercises/PlaceholderList.tsx src/components/exercises/PlaceholderList.test.tsx src/components/exercises/TaskForm.tsx src/components/exercises/TaskAccordion.tsx src/app/exercises/draft/page.tsx messages/en.json messages/uk.json
git show --stat HEAD
```

---

### Task 8: Файлы — AttachmentList (upload/download)

**Files:**
- Create: `src/components/exercises/AttachmentList.tsx`
- Create: `src/components/exercises/AttachmentList.test.tsx`
- Modify: `src/components/exercises/TaskForm.tsx` (маркер `SECTION:ATTACHMENTS` → `<AttachmentList/>`)
- Modify: `messages/en.json`, `messages/uk.json`

**Interfaces:**
- Consumes: `uploadExerciseFile`, `exerciseFileURL` из `@/api/exercises/files`; `exerciseErrorMessage`; `useFieldArray` по `Variants.${vi}.Tasks.${ti}.Attachments` (`{ FileID, Name }`); ui `Button`, `Spinner`.
- Produces: `AttachmentList({ variantIndex: number; taskIndex: number; disabled: boolean })`.

Замечания: прогресс — индетерминированный («Завантаження…» + spinner): fetch не даёт upload-progress без XHR, а лимит размера контролирует бэкенд (413/`ErrFileTooLarge` 21002 → «Файл перевищує максимальний розмір завантаження» через словарь Task 1). Скачивание — обычная ссылка `<a href={exerciseFileURL(id)}>` (cookie-auth).

- [ ] **Step 1: Написать падающий тест**

`src/components/exercises/AttachmentList.test.tsx`:

```tsx
/**
 * AttachmentList.test.tsx — upload добавляет строку, download-ссылка, ошибка лимита.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { useForm, FormProvider } from 'react-hook-form'

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))
vi.mock('@/api/exercises/files', () => ({
  uploadExerciseFile: vi.fn(),
  exerciseFileURL: (id: string) => `/api/exercises/files/${id}`,
}))
vi.mock('@/lib/exerciseErrors', () => ({
  exerciseErrorMessage: () => 'admin.ex.err.fileTooLarge',
}))

import { uploadExerciseFile } from '@/api/exercises/files'
import { AttachmentList } from './AttachmentList'
import { emptyDraft, type DraftFormValues } from '@/lib/exerciseSchemas'

const mockUpload = vi.mocked(uploadExerciseFile)

function Harness({ attachments = [] as { FileID: string; Name: string }[] }) {
  const draft = emptyDraft()
  draft.Variants[0].Tasks[0].Attachments = attachments
  const form = useForm<DraftFormValues>({ defaultValues: draft })
  return (
    <FormProvider {...form}>
      <AttachmentList variantIndex={0} taskIndex={0} disabled={false} />
    </FormProvider>
  )
}

describe('AttachmentList', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders existing attachments with a download link', () => {
    render(<Harness attachments={[{ FileID: 'f1', Name: 'notes.pdf' }]} />)
    const link = screen.getByText('notes.pdf').closest('a')
    expect(link).toHaveAttribute('href', '/api/exercises/files/f1')
  })

  it('uploads a picked file and appends a row', async () => {
    mockUpload.mockResolvedValue({ FileID: 'f2', Name: 'dump.bin', Size: 10 })
    render(<Harness />)
    const input = screen.getByTestId('attachment-file-input')
    const file = new File(['x'], 'dump.bin')
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(screen.getByText('dump.bin')).toBeInTheDocument())
    expect(mockUpload).toHaveBeenCalledWith(file)
  })

  it('shows the mapped error when upload fails', async () => {
    mockUpload.mockRejectedValue(new Error('413'))
    render(<Harness />)
    const input = screen.getByTestId('attachment-file-input')
    fireEvent.change(input, { target: { files: [new File(['x'], 'big.bin')] } })
    expect(await screen.findByText('admin.ex.err.fileTooLarge')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Запустить — падает**

Run: `npx vitest run src/components/exercises/AttachmentList.test.tsx`
Expected: FAIL — «Cannot find module './AttachmentList'».

- [ ] **Step 3: Реализовать `src/components/exercises/AttachmentList.tsx`**

```tsx
"use client"

import { useRef, useState } from "react"
import { useFieldArray, useFormContext } from "react-hook-form"
import { Paperclip, Trash2 } from "lucide-react"
import { t } from "@/i18n/t"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { uploadExerciseFile, exerciseFileURL } from "@/api/exercises/files"
import { exerciseErrorMessage } from "@/lib/exerciseErrors"
import type { DraftFormValues } from "@/lib/exerciseSchemas"

/**
 * AttachmentList — вложения задачи. Upload: POST /api/exercises/files
 * (multipart), лимит размера у бэкенда (ErrFileTooLarge → словарь).
 * Download: обычная ссылка (cookie-auth). Сами файлы в форме не живут —
 * только {FileID, Name}.
 */
export function AttachmentList({
  variantIndex,
  taskIndex,
  disabled,
}: {
  variantIndex: number
  taskIndex: number
  disabled: boolean
}) {
  const { control } = useFormContext<DraftFormValues>()
  const name = `Variants.${variantIndex}.Tasks.${taskIndex}.Attachments` as const
  const { fields, append, remove } = useFieldArray({ control, name })
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = "" // позволяет выбрать тот же файл повторно
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const uploaded = await uploadExerciseFile(file)
      append({ FileID: uploaded.FileID, Name: uploaded.Name })
    } catch (err) {
      setError(exerciseErrorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{t("admin.exFiles.title")}</span>
        {!disabled && (
          <>
            <input
              ref={fileRef}
              data-testid="attachment-file-input"
              type="file"
              className="hidden"
              onChange={onPicked}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <Paperclip className="mr-1 h-4 w-4" />
              {t("admin.exFiles.upload")}
            </Button>
          </>
        )}
      </div>

      {uploading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Spinner label={t("admin.exFiles.uploading")} />
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {fields.length === 0 && !uploading ? (
        <p className="text-xs text-muted-foreground">{t("admin.exFiles.empty")}</p>
      ) : (
        <ul className="space-y-1">
          {fields.map((field, ai) => (
            <li key={field.id} className="flex items-center gap-2 text-sm">
              <a
                href={exerciseFileURL(field.FileID)}
                download={field.Name}
                className="text-primary hover:underline"
              >
                {field.Name}
              </a>
              {!disabled && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`remove-attachment-${ai}`}
                  onClick={() => remove(ai)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Подключить в TaskForm**

В `src/components/exercises/TaskForm.tsx`:

1) импорт:

```tsx
import { AttachmentList } from "./AttachmentList"
```

2) заменить строку

```tsx
      {/* SECTION:ATTACHMENTS — Task 8 заменит на <AttachmentList .../> */}
```

на

```tsx
      <AttachmentList variantIndex={variantIndex} taskIndex={taskIndex} disabled={disabled} />
```

- [ ] **Step 5: Добавить i18n-ключи файлов**

В `messages/en.json`:

```json
  "admin.exFiles.title": "Attachments",
  "admin.exFiles.upload": "Upload file",
  "admin.exFiles.uploading": "Uploading…",
  "admin.exFiles.empty": "No attachments"
```

В `messages/uk.json`:

```json
  "admin.exFiles.title": "Вкладення",
  "admin.exFiles.upload": "Завантажити файл",
  "admin.exFiles.uploading": "Завантаження…",
  "admin.exFiles.empty": "Немає вкладень"
```

- [ ] **Step 6: Прогнать тесты — зелёные**

Run: `npx vitest run src/components/exercises/AttachmentList.test.tsx src/app/exercises/draft/page.test.tsx`
Expected: PASS.

- [ ] **Step 7: Полная верификация и коммит**

Run: `npm run lint && npm run test`
Expected: PASS.

```bash
git add src/components/exercises/AttachmentList.tsx src/components/exercises/AttachmentList.test.tsx src/components/exercises/TaskForm.tsx messages/en.json messages/uk.json
git commit -m "feat(admin): task attachments — multipart upload and cookie-auth download" -- src/components/exercises/AttachmentList.tsx src/components/exercises/AttachmentList.test.tsx src/components/exercises/TaskForm.tsx messages/en.json messages/uk.json
git show --stat HEAD
```

---

### Task 9: Топология — DeviceCard/InterfaceForm/ConnectionList + NetworkToggles

**Files:**
- Create: `src/components/exercises/NetworkToggles.tsx`
- Create: `src/components/exercises/InterfaceForm.tsx`
- Create: `src/components/exercises/DeviceCard.tsx`
- Create: `src/components/exercises/DeviceCard.test.tsx`
- Create: `src/components/exercises/ConnectionList.tsx`
- Create: `src/components/exercises/ConnectionList.test.tsx`
- Create: `src/components/exercises/TopologySection.tsx`
- Modify: `src/app/exercises/draft/page.tsx` (вставить `TopologySection` в `renderVariant`)
- Modify: `messages/en.json`, `messages/uk.json`

**Interfaces:**
- Consumes: `DraftFormValues`, `emptyDevice`, `emptyInterface` из `@/lib/exerciseSchemas`; тип `DeviceType`, `NormalizedEndpoint` из `@/api/exercises/versions`; ui `Input`, `Button`, `Switch`, `SelectMenu`, `Form*`.
- Produces:
  - `NetworkToggles({ variantIndex: number; disabled: boolean })` — VPN/Internet Enabled+DHCP;
  - `InterfaceForm({ variantIndex: number; deviceIndex: number; disabled: boolean })` — список интерфейсов устройства;
  - `DeviceCard({ variantIndex: number; deviceIndex: number; disabled: boolean; onRemove: () => void })` — содержит маркер `{/* SECTION:ENVVARS */}` (Task 11);
  - `ConnectionList({ variantIndex: number; disabled: boolean })` — кодирование endpoint-значения: `"vpn" | "internet" | "device:<DeviceID>:<Interface>"` (у свича/хаба Interface пустой);
  - `TopologySection({ variantIndex: number; disabled: boolean })` — секция целиком, с маркером `{/* SECTION:DIAGRAM */}` (Task 10).

- [ ] **Step 1: Написать падающие тесты DeviceCard и ConnectionList**

`src/components/exercises/DeviceCard.test.tsx`:

```tsx
/**
 * DeviceCard.test.tsx — свитч/хаб показывают только имя+тип; container — всё.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useForm, FormProvider } from 'react-hook-form'

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))

import { DeviceCard } from './DeviceCard'
import { emptyDraft, emptyDevice, type DraftFormValues, type DeviceFormValues } from '@/lib/exerciseSchemas'

function Harness({ device }: { device: DeviceFormValues }) {
  const draft = emptyDraft()
  draft.Variants[0].Topology.Devices = [device]
  const form = useForm<DraftFormValues>({ defaultValues: draft })
  return (
    <FormProvider {...form}>
      <DeviceCard variantIndex={0} deviceIndex={0} disabled={false} onRemove={() => {}} />
    </FormProvider>
  )
}

describe('DeviceCard', () => {
  it('container: показує образ, інтерфейси та зовнішній доступ', () => {
    const device = emptyDevice()
    device.Name = 'web'
    render(<Harness device={device} />)
    expect(screen.getByText('admin.exTopo.image')).toBeInTheDocument()
    expect(screen.getByText('admin.exTopo.interfaces')).toBeInTheDocument()
    expect(screen.getByText('admin.exTopo.external')).toBeInTheDocument()
  })

  it('unmanaged-switch: лише імʼя і тип', () => {
    const device = emptyDevice()
    device.Name = 'sw1'
    device.Type = 'unmanaged-switch'
    device.Interfaces = []
    render(<Harness device={device} />)
    expect(screen.queryByText('admin.exTopo.image')).not.toBeInTheDocument()
    expect(screen.queryByText('admin.exTopo.interfaces')).not.toBeInTheDocument()
    expect(screen.queryByText('admin.exTopo.external')).not.toBeInTheDocument()
  })
})
```

`src/components/exercises/ConnectionList.test.tsx`:

```tsx
/**
 * ConnectionList.test.tsx — опции концов из топологии, кодирование endpoint.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useForm, FormProvider } from 'react-hook-form'

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))

import { ConnectionList, encodeEndpoint, decodeEndpoint } from './ConnectionList'
import { emptyDraft, emptyDevice, type DraftFormValues } from '@/lib/exerciseSchemas'

describe('encode/decodeEndpoint', () => {
  it('vpn/internet кодируются как есть', () => {
    expect(encodeEndpoint({ Kind: 'vpn', DeviceID: '', Interface: '' })).toBe('vpn')
    expect(decodeEndpoint('internet')).toEqual({ Kind: 'internet', DeviceID: '', Interface: '' })
  })

  it('device кодируется как device:<id>:<iface> (iface может быть пустым)', () => {
    expect(encodeEndpoint({ Kind: 'device', DeviceID: 'd1', Interface: 'eth0' })).toBe('device:d1:eth0')
    expect(decodeEndpoint('device:d1:eth0')).toEqual({ Kind: 'device', DeviceID: 'd1', Interface: 'eth0' })
    expect(decodeEndpoint('device:sw1:')).toEqual({ Kind: 'device', DeviceID: 'sw1', Interface: '' })
  })
})

function Harness() {
  const draft = emptyDraft()
  const web = emptyDevice()
  web.Name = 'web' // container c eth0
  const sw = emptyDevice()
  sw.Name = 'sw1'
  sw.Type = 'unmanaged-switch'
  sw.Interfaces = []
  draft.Variants[0].Topology.Devices = [web, sw]
  draft.Variants[0].Topology.Connections = [{
    Endpoints: [
      { Kind: 'vpn', DeviceID: '', Interface: '' },
      { Kind: 'device', DeviceID: web.ID, Interface: 'eth0' },
    ],
  }]
  const form = useForm<DraftFormValues>({ defaultValues: draft })
  return (
    <FormProvider {...form}>
      <ConnectionList variantIndex={0} disabled={false} />
    </FormProvider>
  )
}

describe('ConnectionList', () => {
  it('рендерит соединение и кнопку добавления', () => {
    render(<Harness />)
    expect(screen.getByText('admin.exTopo.connections')).toBeInTheDocument()
    // выбранные значения концов видны в триггерах select
    expect(screen.getByText('admin.exTopo.endpoint.vpn')).toBeInTheDocument()
    expect(screen.getByText('web · eth0')).toBeInTheDocument()
  })

  it('добавляет пустое соединение', () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('admin.exTopo.addConnection'))
    expect(screen.getAllByText('admin.exTopo.endpoint.placeholder').length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Запустить — падают**

Run: `npx vitest run src/components/exercises/DeviceCard.test.tsx src/components/exercises/ConnectionList.test.tsx`
Expected: FAIL — «Cannot find module».

- [ ] **Step 3: Реализовать `src/components/exercises/NetworkToggles.tsx`**

```tsx
"use client"

import { Controller, useFormContext } from "react-hook-form"
import { t } from "@/i18n/t"
import { Switch } from "@/components/ui/switch"
import type { DraftFormValues } from "@/lib/exerciseSchemas"

/** NetworkToggles — VPN/Internet: Enabled + DHCP на вариант. */
export function NetworkToggles({
  variantIndex,
  disabled,
}: {
  variantIndex: number
  disabled: boolean
}) {
  const { control } = useFormContext<DraftFormValues>()
  const nets = [
    { key: "VPN", label: t("admin.exTopo.vpn") },
    { key: "Internet", label: t("admin.exTopo.internet") },
  ] as const

  return (
    <div className="flex flex-wrap gap-4">
      {nets.map((net) => (
        <div key={net.key} className="flex items-center gap-4 rounded-md border border-border px-3 py-2">
          <span className="text-sm font-medium">{net.label}</span>
          <Controller
            control={control}
            name={`Variants.${variantIndex}.Topology.${net.key}.Enabled`}
            render={({ field }) => (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Switch checked={field.value} onCheckedChange={field.onChange} disabled={disabled} />
                {t("admin.exTopo.enabled")}
              </label>
            )}
          />
          <Controller
            control={control}
            name={`Variants.${variantIndex}.Topology.${net.key}.DHCP`}
            render={({ field }) => (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Switch checked={field.value} onCheckedChange={field.onChange} disabled={disabled} />
                DHCP
              </label>
            )}
          />
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Реализовать `src/components/exercises/InterfaceForm.tsx`**

```tsx
"use client"

import { Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form"
import { Plus, Trash2 } from "lucide-react"
import { t } from "@/i18n/t"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { SelectMenu } from "@/components/ui/select-menu"
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { emptyInterface, type DraftFormValues } from "@/lib/exerciseSchemas"

const IP_TYPES = [
  { value: "static", labelKey: "admin.exTopo.ip.static" },
  { value: "dhcp", labelKey: "admin.exTopo.ip.dhcp" },
  { value: "none", labelKey: "admin.exTopo.ip.none" },
]

/** Список CIDR-адресов интерфейса (только static). */
function AddressList({
  value,
  onChange,
  disabled,
}: {
  value: string[]
  onChange: (v: string[]) => void
  disabled: boolean
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{t("admin.exTopo.addresses")}</span>
        {!disabled && (
          <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, ""])}>
            <Plus className="mr-1 h-3 w-3" />
            {t("admin.exTopo.addAddress")}
          </Button>
        )}
      </div>
      {value.map((addr, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={addr}
            placeholder="10.0.0.2/24"
            disabled={disabled}
            onChange={(e) => onChange(value.map((v, j) => (j === i ? e.target.value : v)))}
          />
          {!disabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={`remove-address-${i}`}
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
    </div>
  )
}

/** InterfaceForm — интерфейсы container/vm: имя, MAC, IP-конфиг. */
export function InterfaceForm({
  variantIndex,
  deviceIndex,
  disabled,
}: {
  variantIndex: number
  deviceIndex: number
  disabled: boolean
}) {
  const { control } = useFormContext<DraftFormValues>()
  const name = `Variants.${variantIndex}.Topology.Devices.${deviceIndex}.Interfaces` as const
  const { fields, append, remove } = useFieldArray({ control, name })
  const rows = useWatch({ control, name }) ?? []

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{t("admin.exTopo.interfaces")}</span>
        {!disabled && (
          <Button type="button" variant="outline" size="sm" onClick={() => append(emptyInterface())}>
            <Plus className="mr-1 h-4 w-4" />
            {t("admin.exTopo.addInterface")}
          </Button>
        )}
      </div>

      {fields.map((field, ii) => {
        const ipType = rows[ii]?.IP?.Type
        return (
          <div key={field.id} className="space-y-2 rounded-md border border-border p-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <FormField control={control} name={`${name}.${ii}.Name`} render={({ field: nameField }) => (
                <FormItem>
                  <FormLabel>{t("admin.exTopo.ifaceName")}</FormLabel>
                  <FormControl><Input {...nameField} disabled={disabled} placeholder="eth0" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={control} name={`${name}.${ii}.MAC`} render={({ field: macField }) => (
                <FormItem>
                  <FormLabel>{t("admin.exTopo.mac")}</FormLabel>
                  <FormControl>
                    <Input {...macField} disabled={disabled} placeholder="02:42:ac:11:00:02" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div>
                <span className="mb-1 block text-xs text-muted-foreground">{t("admin.exTopo.ipType")}</span>
                <Controller
                  control={control}
                  name={`${name}.${ii}.IP.Type`}
                  render={({ field: typeField }) => (
                    <SelectMenu
                      value={typeField.value}
                      onChange={typeField.onChange}
                      disabled={disabled}
                      options={IP_TYPES.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                      className="w-full"
                    />
                  )}
                />
              </div>
            </div>

            {ipType === "static" && (
              <div className="grid gap-2 sm:grid-cols-2">
                <Controller
                  control={control}
                  name={`${name}.${ii}.IP.Addresses`}
                  render={({ field: addrField, fieldState }) => (
                    <div>
                      <AddressList value={addrField.value} onChange={addrField.onChange} disabled={disabled} />
                      {fieldState.error && (
                        <p className="text-[0.8rem] font-medium text-destructive">
                          {fieldState.error.message ?? fieldState.error.root?.message}
                        </p>
                      )}
                    </div>
                  )}
                />
                <FormField control={control} name={`${name}.${ii}.IP.Gateway`} render={({ field: gwField }) => (
                  <FormItem>
                    <FormLabel>{t("admin.exTopo.gateway")}</FormLabel>
                    <FormControl><Input {...gwField} disabled={disabled} placeholder="10.0.0.1" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            )}

            {!disabled && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`remove-interface-${ii}`}
                onClick={() => remove(ii)}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                {t("admin.exTopo.removeInterface")}
              </Button>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5: Реализовать `src/components/exercises/DeviceCard.tsx`**

```tsx
"use client"

import { Controller, useFormContext, useWatch } from "react-hook-form"
import { Trash2 } from "lucide-react"
import { t } from "@/i18n/t"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { SelectMenu } from "@/components/ui/select-menu"
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { InterfaceForm } from "./InterfaceForm"
import type { DraftFormValues } from "@/lib/exerciseSchemas"
import type { DeviceType, Protocol } from "@/api/exercises/versions"

const DEVICE_TYPES: { value: DeviceType; labelKey: string }[] = [
  { value: "container", labelKey: "admin.exTopo.type.container" },
  { value: "vm", labelKey: "admin.exTopo.type.vm" },
  { value: "unmanaged-switch", labelKey: "admin.exTopo.type.switch" },
  { value: "hub", labelKey: "admin.exTopo.type.hub" },
]

const PROTOCOLS: Protocol[] = ["http", "https"]

/** DeviceCard — одно устройство топологии. Свитч/хаб — только имя+тип. */
export function DeviceCard({
  variantIndex,
  deviceIndex,
  disabled,
  onRemove,
}: {
  variantIndex: number
  deviceIndex: number
  disabled: boolean
  onRemove: () => void
}) {
  const { control, setValue } = useFormContext<DraftFormValues>()
  const base = `Variants.${variantIndex}.Topology.Devices.${deviceIndex}` as const
  const type = useWatch({ control, name: `${base}.Type` })
  const externalEnabled = useWatch({ control, name: `${base}.External.Enabled` })
  const forwarding = type === "unmanaged-switch" || type === "hub"

  function onTypeChange(next: string, fieldOnChange: (v: string) => void) {
    fieldOnChange(next)
    if (next === "unmanaged-switch" || next === "hub") {
      // Свитч/хаб «голый»: чистим поля, запрещённые доменом (ErrDeviceTypeInvalid).
      setValue(`${base}.Image`, "")
      setValue(`${base}.Interfaces`, [])
      setValue(`${base}.EnvVars`, [])
      setValue(`${base}.External`, { Enabled: false, Port: 80, Protocol: "http" })
    }
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="grid flex-1 gap-2 sm:grid-cols-2">
          <FormField control={control} name={`${base}.Name`} render={({ field }) => (
            <FormItem>
              <FormLabel>{t("admin.exTopo.deviceName")}</FormLabel>
              <FormControl><Input {...field} disabled={disabled} placeholder="web-01" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={control} name={`${base}.Type`} render={({ field }) => (
            <FormItem>
              <FormLabel>{t("admin.exTopo.deviceType")}</FormLabel>
              <FormControl>
                <SelectMenu
                  value={field.value}
                  onChange={(v) => onTypeChange(v, field.onChange)}
                  disabled={disabled}
                  options={DEVICE_TYPES.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                  className="w-full"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        {!disabled && (
          <Button type="button" variant="outline" size="sm" aria-label={`remove-device-${deviceIndex}`} onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {!forwarding && (
        <>
          <FormField control={control} name={`${base}.Image`} render={({ field }) => (
            <FormItem>
              <FormLabel>{t("admin.exTopo.image")}</FormLabel>
              <FormControl><Input {...field} disabled={disabled} placeholder="nginx:1.27" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <InterfaceForm variantIndex={variantIndex} deviceIndex={deviceIndex} disabled={disabled} />

          {/* SECTION:ENVVARS — Task 11 добавит блок переменных окружения с SecretInput */}

          <div className="space-y-2 rounded-md border border-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{t("admin.exTopo.external")}</span>
              <Controller
                control={control}
                name={`${base}.External.Enabled`}
                render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} disabled={disabled} />
                )}
              />
            </div>
            {externalEnabled && (
              <div className="grid gap-2 sm:grid-cols-2">
                <FormField control={control} name={`${base}.External.Port`} render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.exTopo.port")}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={65535}
                        value={field.value}
                        disabled={disabled}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div>
                  <span className="mb-1 block text-xs text-muted-foreground">{t("admin.exTopo.protocol")}</span>
                  <Controller
                    control={control}
                    name={`${base}.External.Protocol`}
                    render={({ field }) => (
                      <SelectMenu
                        value={field.value}
                        onChange={field.onChange}
                        disabled={disabled}
                        options={PROTOCOLS.map((p) => ({ value: p, label: p }))}
                        className="w-full"
                      />
                    )}
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Реализовать `src/components/exercises/ConnectionList.tsx`**

```tsx
"use client"

import { Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form"
import { Plus, Trash2 } from "lucide-react"
import { t } from "@/i18n/t"
import { Button } from "@/components/ui/button"
import { SelectMenu } from "@/components/ui/select-menu"
import type { NormalizedEndpoint } from "@/api/exercises/versions"
import type { DraftFormValues } from "@/lib/exerciseSchemas"

/** Кодирование конца соединения в значение select: vpn | internet | device:<id>:<iface>. */
export function encodeEndpoint(ep: NormalizedEndpoint): string {
  if (ep.Kind === "device") return `device:${ep.DeviceID}:${ep.Interface}`
  return ep.Kind
}

export function decodeEndpoint(value: string): NormalizedEndpoint {
  if (value === "vpn" || value === "internet") {
    return { Kind: value, DeviceID: "", Interface: "" }
  }
  const rest = value.slice("device:".length)
  const sep = rest.indexOf(":")
  return { Kind: "device", DeviceID: rest.slice(0, sep), Interface: rest.slice(sep + 1) }
}

/**
 * ConnectionList — пары концов «устройство/интерфейс | VPN | Internet».
 * Устройства адресуются по ID (клиентский uuid у новых), у свича/хаба
 * интерфейс не указывается (правило домена).
 */
export function ConnectionList({
  variantIndex,
  disabled,
}: {
  variantIndex: number
  disabled: boolean
}) {
  const { control } = useFormContext<DraftFormValues>()
  const name = `Variants.${variantIndex}.Topology.Connections` as const
  const { fields, append, remove } = useFieldArray({ control, name })
  const devices = useWatch({ control, name: `Variants.${variantIndex}.Topology.Devices` }) ?? []

  const endpointOptions = [
    { value: "vpn", label: t("admin.exTopo.endpoint.vpn") },
    { value: "internet", label: t("admin.exTopo.endpoint.internet") },
    ...devices.flatMap((d) => {
      const label = d.Name || d.ID.slice(0, 8)
      if (d.Type === "unmanaged-switch" || d.Type === "hub") {
        return [{ value: `device:${d.ID}:`, label }]
      }
      return d.Interfaces.map((iface) => ({
        value: `device:${d.ID}:${iface.Name}`,
        label: `${label} · ${iface.Name}`,
      }))
    }),
  ]

  function addConnection() {
    append({
      Endpoints: [
        { Kind: "device", DeviceID: "", Interface: "" },
        { Kind: "device", DeviceID: "", Interface: "" },
      ],
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs uppercase tracking-wider text-muted-foreground">{t("admin.exTopo.connections")}</h4>
        {!disabled && (
          <Button type="button" variant="outline" size="sm" onClick={addConnection}>
            <Plus className="mr-1 h-4 w-4" />
            {t("admin.exTopo.addConnection")}
          </Button>
        )}
      </div>

      {fields.map((field, ci) => (
        <div key={field.id} className="flex flex-wrap items-center gap-2">
          {([0, 1] as const).map((side) => (
            <Controller
              key={side}
              control={control}
              name={`${name}.${ci}.Endpoints.${side}`}
              render={({ field: epField, fieldState }) => (
                <div className="min-w-52 flex-1">
                  <SelectMenu
                    value={epField.value.Kind === "device" && epField.value.DeviceID === ""
                      ? ""
                      : encodeEndpoint(epField.value)}
                    onChange={(v) => epField.onChange(decodeEndpoint(v))}
                    disabled={disabled}
                    placeholder={t("admin.exTopo.endpoint.placeholder")}
                    options={endpointOptions}
                    className="w-full"
                  />
                  {fieldState.error && (
                    <p className="text-[0.8rem] font-medium text-destructive">
                      {fieldState.error.message ?? t("admin.ex.val.endpointDevice")}
                    </p>
                  )}
                </div>
              )}
            />
          ))}
          {!disabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={`remove-connection-${ci}`}
              onClick={() => remove(ci)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 7: Реализовать `src/components/exercises/TopologySection.tsx` и вставить в редактор**

`src/components/exercises/TopologySection.tsx`:

```tsx
"use client"

import { useFieldArray, useFormContext } from "react-hook-form"
import { Plus } from "lucide-react"
import { t } from "@/i18n/t"
import { Button } from "@/components/ui/button"
import { emptyDevice, type DraftFormValues } from "@/lib/exerciseSchemas"
import { NetworkToggles } from "./NetworkToggles"
import { DeviceCard } from "./DeviceCard"
import { ConnectionList } from "./ConnectionList"

/** TopologySection — топология одного варианта: сети, устройства, соединения. */
export function TopologySection({
  variantIndex,
  disabled,
}: {
  variantIndex: number
  disabled: boolean
}) {
  const { control } = useFormContext<DraftFormValues>()
  const { fields, append, remove } = useFieldArray({
    control,
    name: `Variants.${variantIndex}.Topology.Devices`,
  })

  return (
    <section className="space-y-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {t("admin.exDraft.topology.title")}
      </h3>

      <NetworkToggles variantIndex={variantIndex} disabled={disabled} />

      <div className="flex items-center justify-between">
        <h4 className="text-xs uppercase tracking-wider text-muted-foreground">{t("admin.exTopo.devices")}</h4>
        {!disabled && (
          <Button type="button" variant="outline" size="sm" onClick={() => append(emptyDevice())}>
            <Plus className="mr-1 h-4 w-4" />
            {t("admin.exTopo.addDevice")}
          </Button>
        )}
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {fields.map((field, di) => (
          <DeviceCard
            key={field.id}
            variantIndex={variantIndex}
            deviceIndex={di}
            disabled={disabled}
            onRemove={() => remove(di)}
          />
        ))}
      </div>

      <ConnectionList variantIndex={variantIndex} disabled={disabled} />

      {/* SECTION:DIAGRAM — Task 10 добавит read-only SVG-схему */}
    </section>
  )
}
```

В `src/app/exercises/draft/page.tsx` добавить импорт и секцию:

```tsx
import { TopologySection } from "@/components/exercises/TopologySection"
```

и заменить

```tsx
                <TaskAccordion variantIndex={variantIndex} disabled={disabled} />
```

на

```tsx
                <TaskAccordion variantIndex={variantIndex} disabled={disabled} />
                <TopologySection variantIndex={variantIndex} disabled={disabled} />
```

- [ ] **Step 8: Добавить i18n-ключи топологии**

В `messages/en.json`:

```json
  "admin.exTopo.vpn": "VPN",
  "admin.exTopo.internet": "Internet",
  "admin.exTopo.enabled": "Enabled",
  "admin.exTopo.devices": "Devices",
  "admin.exTopo.addDevice": "Add device",
  "admin.exTopo.deviceName": "Name (DNS label)",
  "admin.exTopo.deviceType": "Type",
  "admin.exTopo.type.container": "Container",
  "admin.exTopo.type.vm": "Virtual machine",
  "admin.exTopo.type.switch": "Switch (unmanaged)",
  "admin.exTopo.type.hub": "Hub",
  "admin.exTopo.image": "Image",
  "admin.exTopo.interfaces": "Interfaces",
  "admin.exTopo.addInterface": "Add interface",
  "admin.exTopo.removeInterface": "Remove interface",
  "admin.exTopo.ifaceName": "Name",
  "admin.exTopo.mac": "MAC (optional)",
  "admin.exTopo.ipType": "IP configuration",
  "admin.exTopo.ip.static": "Static",
  "admin.exTopo.ip.dhcp": "DHCP",
  "admin.exTopo.ip.none": "No IP",
  "admin.exTopo.addresses": "Addresses (CIDR)",
  "admin.exTopo.addAddress": "Add address",
  "admin.exTopo.gateway": "Gateway",
  "admin.exTopo.external": "External access",
  "admin.exTopo.port": "Port",
  "admin.exTopo.protocol": "Protocol",
  "admin.exTopo.connections": "Connections",
  "admin.exTopo.addConnection": "Add connection",
  "admin.exTopo.endpoint.vpn": "VPN",
  "admin.exTopo.endpoint.internet": "Internet",
  "admin.exTopo.endpoint.placeholder": "Choose an endpoint…"
```

В `messages/uk.json`:

```json
  "admin.exTopo.vpn": "VPN",
  "admin.exTopo.internet": "Інтернет",
  "admin.exTopo.enabled": "Увімкнено",
  "admin.exTopo.devices": "Пристрої",
  "admin.exTopo.addDevice": "Додати пристрій",
  "admin.exTopo.deviceName": "Імʼя (DNS-мітка)",
  "admin.exTopo.deviceType": "Тип",
  "admin.exTopo.type.container": "Контейнер",
  "admin.exTopo.type.vm": "Віртуальна машина",
  "admin.exTopo.type.switch": "Свіч (некерований)",
  "admin.exTopo.type.hub": "Хаб",
  "admin.exTopo.image": "Образ",
  "admin.exTopo.interfaces": "Інтерфейси",
  "admin.exTopo.addInterface": "Додати інтерфейс",
  "admin.exTopo.removeInterface": "Видалити інтерфейс",
  "admin.exTopo.ifaceName": "Імʼя",
  "admin.exTopo.mac": "MAC (необовʼязково)",
  "admin.exTopo.ipType": "IP-конфігурація",
  "admin.exTopo.ip.static": "Статична",
  "admin.exTopo.ip.dhcp": "DHCP",
  "admin.exTopo.ip.none": "Без IP",
  "admin.exTopo.addresses": "Адреси (CIDR)",
  "admin.exTopo.addAddress": "Додати адресу",
  "admin.exTopo.gateway": "Шлюз",
  "admin.exTopo.external": "Зовнішній доступ",
  "admin.exTopo.port": "Порт",
  "admin.exTopo.protocol": "Протокол",
  "admin.exTopo.connections": "Зʼєднання",
  "admin.exTopo.addConnection": "Додати зʼєднання",
  "admin.exTopo.endpoint.vpn": "VPN",
  "admin.exTopo.endpoint.internet": "Інтернет",
  "admin.exTopo.endpoint.placeholder": "Оберіть кінець зʼєднання…"
```

- [ ] **Step 9: Прогнать тесты — зелёные**

Run: `npx vitest run src/components/exercises/DeviceCard.test.tsx src/components/exercises/ConnectionList.test.tsx src/app/exercises/draft/page.test.tsx`
Expected: PASS.

- [ ] **Step 10: Полная верификация и коммит**

Run: `npm run lint && npm run test`
Expected: PASS.

```bash
git add src/components/exercises/NetworkToggles.tsx src/components/exercises/InterfaceForm.tsx src/components/exercises/DeviceCard.tsx src/components/exercises/DeviceCard.test.tsx src/components/exercises/ConnectionList.tsx src/components/exercises/ConnectionList.test.tsx src/components/exercises/TopologySection.tsx src/app/exercises/draft/page.tsx messages/en.json messages/uk.json
git commit -m "feat(admin): topology editor — devices, interfaces, connections, VPN/Internet toggles" -- src/components/exercises/NetworkToggles.tsx src/components/exercises/InterfaceForm.tsx src/components/exercises/DeviceCard.tsx src/components/exercises/DeviceCard.test.tsx src/components/exercises/ConnectionList.tsx src/components/exercises/ConnectionList.test.tsx src/components/exercises/TopologySection.tsx src/app/exercises/draft/page.tsx messages/en.json messages/uk.json
git show --stat HEAD
```

---

### Task 10: TopologyDiagram — самописный read-only SVG

**Files:**
- Create: `src/components/exercises/TopologyDiagram.tsx`
- Create: `src/components/exercises/TopologyDiagram.test.tsx`
- Modify: `src/components/exercises/TopologySection.tsx` (маркер `SECTION:DIAGRAM` → диаграмма из `useWatch`)
- Modify: `messages/en.json`, `messages/uk.json`

**Interfaces:**
- Consumes: `type TopologyFormValues` из `@/lib/exerciseSchemas`; `useWatch` в родителе.
- Produces: `TopologyDiagram({ topology: TopologyFormValues })` — чистый компонент без внешних библиотек: детерминированная раскладка по окружности (порядок объявления), контейнер/VM — круг, свитч/хаб — квадрат, VPN/Internet — пилюли-бейджи, соединения — линии с подписями интерфейсов.

- [ ] **Step 1: Написать падающий тест**

`src/components/exercises/TopologyDiagram.test.tsx`:

```tsx
/**
 * TopologyDiagram.test.tsx — узлы и связи из снапшота топологии.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))

import { TopologyDiagram } from './TopologyDiagram'
import type { TopologyFormValues } from '@/lib/exerciseSchemas'

const topology: TopologyFormValues = {
  VPN: { Enabled: true, DHCP: true },
  Internet: { Enabled: false, DHCP: false },
  Devices: [
    {
      ID: 'd1', Name: 'web', Type: 'container', Image: 'nginx',
      Interfaces: [{ Name: 'eth0', MAC: '', IP: { Type: 'dhcp', Addresses: [], Gateway: '' } }],
      EnvVars: [], External: { Enabled: false, Port: 80, Protocol: 'http' },
    },
    {
      ID: 'd2', Name: 'sw1', Type: 'unmanaged-switch', Image: '',
      Interfaces: [], EnvVars: [], External: { Enabled: false, Port: 80, Protocol: 'http' },
    },
  ],
  Connections: [
    { Endpoints: [{ Kind: 'device', DeviceID: 'd1', Interface: 'eth0' }, { Kind: 'device', DeviceID: 'd2', Interface: '' }] },
    { Endpoints: [{ Kind: 'vpn', DeviceID: '', Interface: '' }, { Kind: 'device', DeviceID: 'd2', Interface: '' }] },
  ],
}

describe('TopologyDiagram', () => {
  it('renders a node per device plus enabled networks', () => {
    render(<TopologyDiagram topology={topology} />)
    expect(screen.getByText('web')).toBeInTheDocument()
    expect(screen.getByText('sw1')).toBeInTheDocument()
    expect(screen.getByText('admin.exTopo.vpn')).toBeInTheDocument() // VPN включён
    expect(screen.queryByText('admin.exTopo.internet')).not.toBeInTheDocument() // Internet выключен
  })

  it('draws shapes by kind: circle for container, square for switch, pill for vpn', () => {
    const { container } = render(<TopologyDiagram topology={topology} />)
    expect(container.querySelector('[data-testid="node-d1"] circle')).not.toBeNull()
    expect(container.querySelector('[data-testid="node-d2"] rect')).not.toBeNull()
    expect(container.querySelector('[data-testid="node-vpn"] rect')).not.toBeNull()
  })

  it('draws a line per resolvable connection and labels interfaces', () => {
    const { container } = render(<TopologyDiagram topology={topology} />)
    expect(container.querySelectorAll('line')).toHaveLength(2)
    expect(screen.getByText('eth0')).toBeInTheDocument()
  })

  it('skips connections with unresolved endpoints', () => {
    const broken: TopologyFormValues = {
      ...topology,
      Connections: [{ Endpoints: [{ Kind: 'device', DeviceID: 'ghost', Interface: '' }, { Kind: 'vpn', DeviceID: '', Interface: '' }] }],
    }
    const { container } = render(<TopologyDiagram topology={broken} />)
    expect(container.querySelectorAll('line')).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Запустить — падает**

Run: `npx vitest run src/components/exercises/TopologyDiagram.test.tsx`
Expected: FAIL — «Cannot find module './TopologyDiagram'».

- [ ] **Step 3: Реализовать `src/components/exercises/TopologyDiagram.tsx` (полный код)**

```tsx
"use client"

import { useMemo } from "react"
import { t } from "@/i18n/t"
import type { TopologyFormValues } from "@/lib/exerciseSchemas"

/**
 * TopologyDiagram — read-only SVG-схема топологии варианта.
 *
 * Формы — источник правды: компонент чистый, значения приходят из useWatch
 * родителя. Раскладка детерминированная: все узлы равномерно по окружности в
 * порядке объявления (устройства, затем VPN/Internet-бейджи). Без внешних
 * библиотек. VisualRender не используется (зарезервирован под канвас).
 */

type NodeKind = "device" | "forwarding" | "vpn" | "internet"
type DiagramNode = { key: string; label: string; kind: NodeKind }
type DiagramEdge = { key: string; a: string; b: string; labelA: string; labelB: string }

const W = 480
const H = 360
const CX = W / 2
const CY = H / 2
const R = Math.min(W, H) / 2 - 52

function layout(nodes: DiagramNode[]): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number }>()
  const n = nodes.length
  nodes.forEach((node, i) => {
    if (n === 1) {
      pos.set(node.key, { x: CX, y: CY })
      return
    }
    const angle = (2 * Math.PI * i) / n - Math.PI / 2
    pos.set(node.key, { x: CX + R * Math.cos(angle), y: CY + R * Math.sin(angle) })
  })
  return pos
}

export function TopologyDiagram({ topology }: { topology: TopologyFormValues }) {
  const { nodes, edges } = useMemo(() => {
    const nodes: DiagramNode[] = topology.Devices.map((d) => ({
      key: d.ID,
      label: d.Name || "?",
      kind: d.Type === "unmanaged-switch" || d.Type === "hub" ? "forwarding" : "device",
    }))
    if (topology.VPN.Enabled) nodes.push({ key: "vpn", label: t("admin.exTopo.vpn"), kind: "vpn" })
    if (topology.Internet.Enabled) nodes.push({ key: "internet", label: t("admin.exTopo.internet"), kind: "internet" })

    const known = new Set(nodes.map((n) => n.key))
    const edges: DiagramEdge[] = []
    topology.Connections.forEach((c, i) => {
      const [a, b] = c.Endpoints
      if (!a || !b) return
      const keyA = a.Kind === "device" ? a.DeviceID : a.Kind
      const keyB = b.Kind === "device" ? b.DeviceID : b.Kind
      if (!known.has(keyA) || !known.has(keyB)) return // неразрешимый конец — пропускаем
      edges.push({ key: `e${i}`, a: keyA, b: keyB, labelA: a.Interface, labelB: b.Interface })
    })
    return { nodes, edges }
  }, [topology])

  const pos = useMemo(() => layout(nodes), [nodes])

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={t("admin.exTopo.diagram")}
      className="w-full max-w-xl rounded-md border border-border bg-background"
    >
      {/* Связи — под узлами */}
      {edges.map((edge) => {
        const pa = pos.get(edge.a)!
        const pb = pos.get(edge.b)!
        return (
          <g key={edge.key}>
            <line
              x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
              className="stroke-muted-foreground/70"
              strokeWidth={1.5}
            />
            {edge.labelA && (
              <text
                x={pa.x + (pb.x - pa.x) * 0.25}
                y={pa.y + (pb.y - pa.y) * 0.25 - 4}
                className="fill-muted-foreground"
                fontSize={9}
                textAnchor="middle"
              >
                {edge.labelA}
              </text>
            )}
            {edge.labelB && (
              <text
                x={pa.x + (pb.x - pa.x) * 0.75}
                y={pa.y + (pb.y - pa.y) * 0.75 - 4}
                className="fill-muted-foreground"
                fontSize={9}
                textAnchor="middle"
              >
                {edge.labelB}
              </text>
            )}
          </g>
        )
      })}

      {/* Узлы */}
      {nodes.map((node) => {
        const p = pos.get(node.key)!
        return (
          <g key={node.key} data-testid={`node-${node.key}`}>
            {node.kind === "forwarding" ? (
              <rect
                x={p.x - 14} y={p.y - 14} width={28} height={28} rx={3}
                className="fill-secondary stroke-border"
                strokeWidth={1.5}
              />
            ) : node.kind === "vpn" || node.kind === "internet" ? (
              <rect
                x={p.x - 28} y={p.y - 12} width={56} height={24} rx={12}
                className={
                  node.kind === "vpn"
                    ? "fill-primary/20 stroke-primary"
                    : "fill-accent/30 stroke-foreground/50"
                }
                strokeWidth={1.5}
              />
            ) : (
              <circle
                cx={p.x} cy={p.y} r={16}
                className="fill-card stroke-primary"
                strokeWidth={1.5}
              />
            )}
            <text
              x={p.x}
              y={node.kind === "vpn" || node.kind === "internet" ? p.y + 4 : p.y + 30}
              className="fill-foreground"
              fontSize={11}
              textAnchor="middle"
            >
              {node.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
```

- [ ] **Step 4: Подключить диаграмму в TopologySection**

В `src/components/exercises/TopologySection.tsx`:

1) дополнить импорты:

```tsx
import { useFieldArray, useFormContext, useWatch } from "react-hook-form"
import { TopologyDiagram } from "./TopologyDiagram"
```

2) внутри компонента после объявления `useFieldArray` добавить:

```tsx
  const topology = useWatch({ control, name: `Variants.${variantIndex}.Topology` })
```

3) заменить строку

```tsx
      {/* SECTION:DIAGRAM — Task 10 добавит read-only SVG-схему */}
```

на

```tsx
      {topology && (
        <div>
          <h4 className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">{t("admin.exTopo.diagram")}</h4>
          <TopologyDiagram topology={topology} />
        </div>
      )}
```

- [ ] **Step 5: Добавить i18n-ключ**

`messages/en.json`: `"admin.exTopo.diagram": "Diagram"`
`messages/uk.json`: `"admin.exTopo.diagram": "Схема"`

- [ ] **Step 6: Прогнать тесты — зелёные**

Run: `npx vitest run src/components/exercises/TopologyDiagram.test.tsx src/app/exercises/draft/page.test.tsx`
Expected: PASS.

- [ ] **Step 7: Полная верификация и коммит**

Run: `npm run lint && npm run test`
Expected: PASS.

```bash
git add src/components/exercises/TopologyDiagram.tsx src/components/exercises/TopologyDiagram.test.tsx src/components/exercises/TopologySection.tsx messages/en.json messages/uk.json
git commit -m "feat(admin): read-only SVG topology diagram computed from form values" -- src/components/exercises/TopologyDiagram.tsx src/components/exercises/TopologyDiagram.test.tsx src/components/exercises/TopologySection.tsx messages/en.json messages/uk.json
git show --stat HEAD
```

---

### Task 11: Секреты — SecretInput + EnvVars в DeviceCard

**Files:**
- Create: `src/components/exercises/SecretInput.tsx`
- Create: `src/components/exercises/SecretInput.test.tsx`
- Modify: `src/components/exercises/DeviceCard.tsx` (маркер `SECTION:ENVVARS` → блок переменных окружения)
- Modify: `messages/en.json`, `messages/uk.json`

**Interfaces:**
- Consumes: `NormalizedEnvVar`-форма (`{ Name, Value, Secret, HasValue }`) в `Variants.${vi}.Topology.Devices.${di}.EnvVars`; ui `Input`, `Button`, `Checkbox`.
- Produces: `SecretInput({ value: string; hasValue: boolean; onChange: (v: string) => void; disabled?: boolean })` — write-only контракт: при `hasValue && value === ""` показывает «значення збережено» + кнопку «Замінити»; ввод нового значения отправится и перезапишет; пустой `Value` = «оставить сохранённое».

- [ ] **Step 1: Написать падающий тест**

`src/components/exercises/SecretInput.test.tsx`:

```tsx
/**
 * SecretInput.test.tsx — write-only секрет: stored-стан, «Замінити», ввод значения.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))

import { SecretInput } from './SecretInput'

describe('SecretInput', () => {
  const onChange = vi.fn()
  beforeEach(() => vi.clearAllMocks())

  it('hasValue + пустое значение → «збережено» и кнопка «Замінити», без input', () => {
    render(<SecretInput value="" hasValue onChange={onChange} />)
    expect(screen.getByText('admin.exSecret.stored')).toBeInTheDocument()
    expect(screen.getByText('admin.exSecret.replace')).toBeInTheDocument()
    expect(screen.queryByTestId('secret-value-input')).not.toBeInTheDocument()
  })

  it('«Замінити» открывает password-input с подсказкой «keep»', () => {
    render(<SecretInput value="" hasValue onChange={onChange} />)
    fireEvent.click(screen.getByText('admin.exSecret.replace'))
    const input = screen.getByTestId('secret-value-input')
    expect(input).toHaveAttribute('type', 'password')
    expect(input).toHaveAttribute('placeholder', 'admin.exSecret.keep')
    fireEvent.change(input, { target: { value: 'hunter2' } })
    expect(onChange).toHaveBeenCalledWith('hunter2')
  })

  it('новый секрет (hasValue=false) сразу показывает input', () => {
    render(<SecretInput value="" hasValue={false} onChange={onChange} />)
    expect(screen.getByTestId('secret-value-input')).toBeInTheDocument()
  })

  it('disabled в stored-стане не показывает «Замінити»', () => {
    render(<SecretInput value="" hasValue disabled onChange={onChange} />)
    expect(screen.getByText('admin.exSecret.stored')).toBeInTheDocument()
    expect(screen.queryByText('admin.exSecret.replace')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Запустить — падает**

Run: `npx vitest run src/components/exercises/SecretInput.test.tsx`
Expected: FAIL — «Cannot find module './SecretInput'».

- [ ] **Step 3: Реализовать `src/components/exercises/SecretInput.tsx`**

```tsx
"use client"

import { useState } from "react"
import { t } from "@/i18n/t"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

/**
 * SecretInput — write-only значение секрета.
 * Контракт бэкенда: в ответах Value пуст, HasValue=true если значение хранится;
 * пустой Value при сохранении = «оставить сохранённое». Поэтому:
 *  - hasValue && value==="" → «значення збережено» + кнопка «Замінити»;
 *  - режим замены/новый секрет → password-input; пустым его можно и оставить
 *    (сохранённое значение не изменится).
 */
export function SecretInput({
  value,
  hasValue,
  onChange,
  disabled,
}: {
  value: string
  hasValue: boolean
  onChange: (v: string) => void
  disabled?: boolean
}) {
  const [replacing, setReplacing] = useState(false)
  const showStored = hasValue && !replacing && value === ""

  if (showStored) {
    return (
      <div className="flex h-9 items-center gap-2">
        <span className="text-xs text-muted-foreground">{t("admin.exSecret.stored")}</span>
        {!disabled && (
          <Button type="button" variant="outline" size="sm" onClick={() => setReplacing(true)}>
            {t("admin.exSecret.replace")}
          </Button>
        )}
      </div>
    )
  }

  return (
    <Input
      data-testid="secret-value-input"
      type="password"
      autoComplete="new-password"
      value={value}
      disabled={disabled}
      placeholder={hasValue ? t("admin.exSecret.keep") : ""}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
```

- [ ] **Step 4: Встроить EnvVars-блок в DeviceCard**

В `src/components/exercises/DeviceCard.tsx`:

1) дополнить импорты:

```tsx
import { Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form"
import { Plus, Trash2 } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { SecretInput } from "./SecretInput"
```

2) добавить компонент в конец файла:

```tsx
/** EnvVarsList — переменные окружения container/vm; секреты через SecretInput. */
function EnvVarsList({
  variantIndex,
  deviceIndex,
  disabled,
}: {
  variantIndex: number
  deviceIndex: number
  disabled: boolean
}) {
  const { control } = useFormContext<DraftFormValues>()
  const name = `Variants.${variantIndex}.Topology.Devices.${deviceIndex}.EnvVars` as const
  const { fields, append, remove } = useFieldArray({ control, name })
  const rows = useWatch({ control, name }) ?? []

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{t("admin.exEnv.title")}</span>
        {!disabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ Name: "", Value: "", Secret: false, HasValue: false })}
          >
            <Plus className="mr-1 h-4 w-4" />
            {t("admin.exEnv.add")}
          </Button>
        )}
      </div>

      {fields.map((field, ei) => {
        const isSecret = rows[ei]?.Secret ?? false
        const hasValue = rows[ei]?.HasValue ?? false
        return (
          <div key={field.id} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
            <FormField control={control} name={`${name}.${ei}.Name`} render={({ field: nameField }) => (
              <FormItem>
                <FormLabel>{t("admin.exEnv.name")}</FormLabel>
                <FormControl><Input {...nameField} disabled={disabled} placeholder="DB_PASS" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div>
              <span className="mb-1 block text-xs text-muted-foreground">{t("admin.exEnv.value")}</span>
              <Controller
                control={control}
                name={`${name}.${ei}.Value`}
                render={({ field: valueField }) =>
                  isSecret ? (
                    <SecretInput
                      value={valueField.value}
                      hasValue={hasValue}
                      onChange={valueField.onChange}
                      disabled={disabled}
                    />
                  ) : (
                    <Input value={valueField.value} onChange={valueField.onChange} disabled={disabled} />
                  )
                }
              />
            </div>
            <Controller
              control={control}
              name={`${name}.${ei}.Secret`}
              render={({ field: secretField }) => (
                <label className="flex items-center gap-1.5 pb-2 text-xs text-muted-foreground">
                  <Checkbox
                    checked={secretField.value}
                    onCheckedChange={(v) => secretField.onChange(v === true)}
                    disabled={disabled}
                  />
                  {t("admin.exEnv.secret")}
                </label>
              )}
            />
            {!disabled && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`remove-envvar-${ei}`}
                onClick={() => remove(ei)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

3) заменить строку-маркер

```tsx
          {/* SECTION:ENVVARS — Task 11 добавит блок переменных окружения с SecretInput */}
```

на

```tsx
          <EnvVarsList variantIndex={variantIndex} deviceIndex={deviceIndex} disabled={disabled} />
```

- [ ] **Step 5: Добавить i18n-ключи секретов/переменных**

В `messages/en.json`:

```json
  "admin.exEnv.title": "Environment variables",
  "admin.exEnv.add": "Add variable",
  "admin.exEnv.name": "Name",
  "admin.exEnv.value": "Value",
  "admin.exEnv.secret": "Secret",
  "admin.exSecret.stored": "Value is stored",
  "admin.exSecret.replace": "Replace",
  "admin.exSecret.keep": "Leave empty to keep the stored value"
```

В `messages/uk.json`:

```json
  "admin.exEnv.title": "Змінні оточення",
  "admin.exEnv.add": "Додати змінну",
  "admin.exEnv.name": "Імʼя",
  "admin.exEnv.value": "Значення",
  "admin.exEnv.secret": "Секрет",
  "admin.exSecret.stored": "Значення збережено",
  "admin.exSecret.replace": "Замінити",
  "admin.exSecret.keep": "Залиште порожнім, щоб зберегти чинне значення"
```

- [ ] **Step 6: Прогнать тесты — зелёные**

Run: `npx vitest run src/components/exercises/SecretInput.test.tsx src/components/exercises/DeviceCard.test.tsx`
Expected: PASS. Read-only режим версии показывает секреты замаскированными автоматически: бэкенд отдаёт `Value=""`+`HasValue=true` → stored-стан без кнопки (disabled).

- [ ] **Step 7: Полная верификация и коммит**

Run: `npm run lint && npm run test`
Expected: PASS.

```bash
git add src/components/exercises/SecretInput.tsx src/components/exercises/SecretInput.test.tsx src/components/exercises/DeviceCard.tsx messages/en.json messages/uk.json
git commit -m "feat(admin): write-only secret env vars with keep/replace semantics" -- src/components/exercises/SecretInput.tsx src/components/exercises/SecretInput.test.tsx src/components/exercises/DeviceCard.tsx messages/en.json messages/uk.json
git show --stat HEAD
```

---

### Task 12: i18n-паритет и полнота словаря ошибок

**Files:**
- Create: `src/i18n/exercisesI18n.test.ts`
- Modify: `messages/en.json`, `messages/uk.json` (только если тест найдёт расхождения)

**Interfaces:**
- Consumes: `messages/en.json`, `messages/uk.json` (build-time JSON), `CODE_TO_KEY` из `@/lib/exerciseErrors` (Task 1 экспортирует словарь; если экспорт не был добавлен — добавить `export` перед `const CODE_TO_KEY` в `src/lib/exerciseErrors.ts`).
- Produces: регрессионный тест, который навсегда фиксирует два инварианта: (1) паритет ключей `admin.ex*` между каталогами, (2) каждый ключ из `CODE_TO_KEY` существует в обоих каталогах.

Ошибки publish/save уже интегрированы в UI задачами 4–6 (блок `publishError` на карточке, `saveError` в редакторе) через `exerciseErrorMessage` из Task 1 — здесь только сквозная сверка каталогов, чтобы битый/забытый ключ не превращался в сырой `admin.ex.…` на экране.

- [ ] **Step 1: Написать тест**

`src/i18n/exercisesI18n.test.ts`:

```ts
/**
 * exercisesI18n.test.ts — parity guard for the admin.ex* key namespace.
 * (1) en.json and uk.json carry the SAME admin.ex* key sets;
 * (2) every error-dictionary key resolves in both catalogs.
 */
import { describe, it, expect } from "vitest"
import en from "../../messages/en.json"
import uk from "../../messages/uk.json"
import { CODE_TO_KEY } from "@/lib/exerciseErrors"

const exKeys = (cat: Record<string, string>) =>
  Object.keys(cat).filter((k) => k.startsWith("admin.ex")).sort()

describe("admin.ex* i18n parity", () => {
  it("en and uk define the same admin.ex* keys", () => {
    const enKeys = exKeys(en as Record<string, string>)
    const ukKeys = exKeys(uk as Record<string, string>)
    expect(ukKeys).toEqual(enKeys)
    expect(enKeys.length).toBeGreaterThan(0)
  })

  it("every error-dictionary key exists in both catalogs", () => {
    for (const key of Object.values(CODE_TO_KEY)) {
      expect((en as Record<string, string>)[key], `en missing ${key}`).toBeTruthy()
      expect((uk as Record<string, string>)[key], `uk missing ${key}`).toBeTruthy()
    }
  })

  it("no admin.ex* value is blank", () => {
    for (const cat of [en, uk] as Record<string, string>[]) {
      for (const k of exKeys(cat)) expect(cat[k].trim(), `blank value for ${k}`).not.toBe("")
    }
  })
})
```

- [ ] **Step 2: Прогнать тест**

Run: `npx vitest run src/i18n/exercisesI18n.test.ts`
Expected: либо PASS сразу, либо FAIL со списком расхождений (missing/blank keys).

- [ ] **Step 3: Починить расхождения (если есть)**

Если тест упал: добавить недостающие ключи в отстающий каталог (украинский текст в `uk.json`, английский в `en.json`) — ровно те ключи, что назвал тест. Если `CODE_TO_KEY` не экспортирован из `src/lib/exerciseErrors.ts`, добавить `export`:

```ts
export const CODE_TO_KEY: Record<number, string> = {
```

- [ ] **Step 4: Прогнать тест — зелёный**

Run: `npx vitest run src/i18n/exercisesI18n.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Полная верификация и коммит**

Run: `npm run lint && npm run test`
Expected: PASS.

```bash
git add src/i18n/exercisesI18n.test.ts messages/en.json messages/uk.json src/lib/exerciseErrors.ts
git commit -m "test(admin): i18n parity guard for exercise catalog keys" -- src/i18n/exercisesI18n.test.ts messages/en.json messages/uk.json src/lib/exerciseErrors.ts
git show --stat HEAD
```
Expected: в коммите только перечисленные файлы (en/uk/exerciseErrors — только если менялись; иначе убрать их из `git add` и pathspec).

---

### Task 13: Финальная верификация

**Files:** нет новых.

- [ ] **Step 1: Полный прогон тестов и линта**

Run: `npm run lint && npm run test`
Expected: всё зелёное, ноль warnings в выводе тестов.

- [ ] **Step 2: Production-сборка (static export)**

Run: `npm run build`
Expected: сборка успешна; в выводе присутствуют маршруты `/exercises`, `/exercises/detail`, `/exercises/draft`; ошибок prerender нет (страницы обязаны быть `"use client"` и не читать `window` на верхнем уровне).

- [ ] **Step 3: Ручной smoke (опционально, при поднятом бэкенде)**

`npm run dev` (порт 3001) → зайти под admin-сессией: создать задание → карточка → чернетка: додати варіант, задачу з флагом і описом, пристрій з інтерфейсом (static + CIDR), з'єднання, секрет → «Зберегти чернетку» → «Опублікувати» → перевірити список версій і read-only перегляд опублікованої версії (секрети замасковані) → завантажити вкладення і скачати його назад.

- [ ] **Step 4: Чистота дерева**

Run: `git status --short`
Expected: остались ТОЛЬКО чужие грязные файлы, которые были до начала работ (deploy/docker-решафл в индексе, правки notifications-тестов, `.claude/`). Ничего нашего незакоммиченного.

- [ ] **Step 5: Commit (если были правки на шагах 1–2)**

```bash
git add <только изменённые нашими фиксами файлы>
git commit -m "fix(admin): final verification fixes for exercise catalog" -- <те же пути>
git show --stat HEAD
```

---

## Self-Review плана (выполнено)

1. **Покрытие спеки:** §3 структура файлов → Tasks 1–11 (все файлы из списка присутствуют в Files-блоках); §4 API-контракт → Task 1 (типы 1:1, PascalCase, normalize); §5 каталог → Task 3; §6 карточка → Tasks 4–5; §7 редактор → Tasks 6–11 (каркас 6, задачи 7, файлы 8, топология 9, SVG 10, секреты 11); §8 ошибки → Task 1 (словарь+интеграция в 4–6) + Task 12 (паритет); §9 тесты → в каждой задаче; §10 вне объёма — не затронуто; §11 порядок работ соблюдён с одним отличием: словарь ошибок перенесён из задачи 12 в Task 1 (нужен потребителям в Tasks 4–6 раньше), Task 12 переопределён как i18n-паритет — отличие зафиксировано в тексте Task 1 и Task 12.
2. **Плейсхолдеры:** отсутствуют; каждый кодовый шаг содержит полный код, каждый Run-шаг — команду и ожидание.
3. **Консистентность типов:** ключи i18n — единый неймспейс `admin.ex*`; типы `Variant`/`ExerciseTask`/`Device`/`NetInterface`/`IPConfig` определены один раз в Task 1 и потребляются по именам в Tasks 2–11; `DraftFormValues` определён в Task 2 и типизирует форму Task 6; сигнатуры компонентов зафиксированы в Interfaces-блоках задач-производителей.
