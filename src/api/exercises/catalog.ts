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
