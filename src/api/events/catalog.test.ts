/**
 * catalog.test.ts — paths, query params and null-normalize for the events client.
 * vi.mock('@/api/client') intercepts all HTTP calls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/client')

import * as client from '@/api/client'
import {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  archiveEvent,
  deleteEvent,
  listEventManagers,
} from './catalog'

const mockApiGet = vi.mocked(client.apiGet)
const mockApiPost = vi.mocked(client.apiPost)
const mockApiPut = vi.mocked(client.apiPut)
const mockApiDelete = vi.mocked(client.apiDelete)

const EV_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

const rawEvent = {
  ID: EV_ID,
  Tag: 'springctf',
  Name: 'Spring CTF',
  AvailableFrom: '2026-03-01T00:00:00Z',
  ArchiveAt: '2026-03-08T00:00:00Z',
  Status: 'pending',
  CreatedAt: '2026-01-01T00:00:00Z',
  UpdatedAt: '2026-01-02T00:00:00Z',
}

const input = {
  Tag: 'springctf',
  Name: 'Spring CTF',
  AvailableFrom: '2026-03-01T00:00:00Z',
  ArchiveAt: '2026-03-08T00:00:00Z',
}

describe('listEvents', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls apiGet with the bare base path when no filter', async () => {
    mockApiGet.mockResolvedValueOnce({ Items: [], Total: 0 })
    await listEvents()
    expect(mockApiGet.mock.calls[0][0]).toBe('/api/events')
  })

  it('builds search, cursor and pageSize params', async () => {
    mockApiGet.mockResolvedValueOnce({ Items: [], Total: 0 })
    await listEvents({ search: 'ctf', cursor: EV_ID, pageSize: 50 })
    expect(mockApiGet.mock.calls[0][0]).toBe(`/api/events?search=ctf&cursor=${EV_ID}&pageSize=50`)
  })

  it('normalises a null Events array to []', async () => {
    mockApiGet.mockResolvedValueOnce({ Items: null, Total: 0 })
    const empty = await listEvents()
    expect(empty.Items).toEqual([])
  })

  it('normalises an old zero archive date to null', async () => {
    mockApiGet.mockResolvedValueOnce({ Items: [{ ...rawEvent, ArchiveAt: '0001-01-01T00:00:00Z' }], Total: 1 })
    const page = await listEvents()
    expect(page.Items[0].ArchiveAt).toBeNull()
  })
})

describe('getEvent', () => {
  beforeEach(() => vi.clearAllMocks())
  it('GETs /:id', async () => {
    mockApiGet.mockResolvedValueOnce(rawEvent)
    const result = await getEvent(EV_ID)
    expect(mockApiGet.mock.calls[0][0]).toBe(`/api/events/${EV_ID}`)
    expect(result.Tag).toBe('springctf')
  })
})

describe('createEvent', () => {
  beforeEach(() => vi.clearAllMocks())
  it('POSTs the input body to the base path', async () => {
    mockApiPost.mockResolvedValueOnce(rawEvent)
    await createEvent(input)
    expect(mockApiPost.mock.calls[0][0]).toBe('/api/events')
    expect(mockApiPost.mock.calls[0][1]).toEqual(input)
  })
})

describe('updateEvent', () => {
  beforeEach(() => vi.clearAllMocks())
  it('PUTs /:id with the input body', async () => {
    mockApiPut.mockResolvedValueOnce(rawEvent)
    await updateEvent(EV_ID, input)
    expect(mockApiPut.mock.calls[0][0]).toBe(`/api/events/${EV_ID}`)
    expect(mockApiPut.mock.calls[0][1]).toEqual(input)
  })
})

describe('archiveEvent', () => {
  beforeEach(() => vi.clearAllMocks())
  it('POSTs /:id/archive with an empty body', async () => {
    mockApiPost.mockResolvedValueOnce({ ...rawEvent, Status: 'archived' })
    const result = await archiveEvent(EV_ID)
    expect(mockApiPost.mock.calls[0][0]).toBe(`/api/events/${EV_ID}/archive`)
    expect(mockApiPost.mock.calls[0][1]).toEqual({})
    expect(result.Status).toBe('archived')
  })
})

describe('deleteEvent', () => {
  beforeEach(() => vi.clearAllMocks())
  it('DELETEs /:id', async () => {
    mockApiDelete.mockResolvedValueOnce(undefined)
    await deleteEvent(EV_ID)
    expect(mockApiDelete.mock.calls[0][0]).toBe(`/api/events/${EV_ID}`)
  })
})

describe('listEventManagers', () => {
  beforeEach(() => vi.clearAllMocks())
  it('GETs event-local access memberships', async () => {
    const managers = [{ UserID: 'owner-1', Role: 0, CreatedAt: '2026-01-01T00:00:00Z' }]
    mockApiGet.mockResolvedValueOnce(managers)
    expect(await listEventManagers(EV_ID)).toEqual(managers)
    expect(mockApiGet).toHaveBeenCalledWith(`/api/events/${EV_ID}/managers`)
  })
})
