/**
 * files.test.ts — multipart-загрузка мимо JSON-клиента + download URL.
 *
 * silentAuth мокается: uploadExerciseFile awaits awaitAuthBootstrap() before its
 * own fetch, and the REAL implementation (jsdom => window defined) would issue a
 * real /api/auth/me probe through the SAME stubbed global fetch, consuming the
 * single queued mock response meant for the multipart POST. Mocking the module
 * keeps the test deterministic and focused on the upload call's shape.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/silentAuth', () => ({ awaitAuthBootstrap: vi.fn().mockResolvedValue(undefined) }))

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
