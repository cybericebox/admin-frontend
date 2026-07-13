/**
 * catalog.test.ts — paths, query params and normalize for the catalog client.
 * vi.mock('@/api/client') intercepts all HTTP calls.
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
