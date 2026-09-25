/**
 * versions.test.ts — lifecycle route paths and normalize for version/variant.
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
  createCheckpoint,
  restoreVersion,
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

  it('creates a checkpoint separately from autosaving the draft', async () => {
    mockApiPost.mockResolvedValueOnce({ ...rawVersion, Status: 'checkpoint' })
    await createCheckpoint(EX_ID)
    expect(mockApiPost.mock.calls[0][0]).toBe(`/api/exercises/${EX_ID}/checkpoints`)
  })

  it('restores a historical version while preserving the current draft', async () => {
    mockApiPost.mockResolvedValueOnce(rawVersion)
    await restoreVersion(EX_ID, VER_ID)
    expect(mockApiPost.mock.calls[0][0]).toBe(`/api/exercises/${EX_ID}/versions/${VER_ID}/restore`)
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
      SecurityPreset: '',
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
