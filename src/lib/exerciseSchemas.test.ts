/**
 * exerciseSchemas.test.ts — table-driven tests for the domain's zod mirror.
 * t is mocked as "key → key": we don't check message language, only that an error occurred.
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
  toDraftFormValues,
  toSaveDraftInput,
  type DraftFormValues,
} from './exerciseSchemas'
import type { Version } from '@/api/exercises/versions'

// ── Regexes and parsers ──────────────────────────────────────────────────────────

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
    ['02:42-ac:11:00:02', false], // mixed separators: net.ParseMAC rejects
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
    ['010.0.0.0/24', false], // leading zero in an octet: Go netip rejects
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
    ['010.0.0.1', false], // leading zero in an octet: Go netip rejects
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
    // emptyDevice() adds one default interface — a switch must be "bare"
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

  it('a vpn/internet endpoint must have no device or interface', () => {
    const draft = validDraft()
    draft.Variants[0].Topology.Connections = [{
      Endpoints: [
        { Kind: 'device', DeviceID: 'some-uuid', Interface: '' },
        { Kind: 'vpn', DeviceID: 'some-uuid', Interface: '' },
      ],
    }]
    expect(draftSchema.safeParse(draft).success).toBe(false)

    draft.Variants[0].Topology.Connections[0].Endpoints[1] = { Kind: 'vpn', DeviceID: '', Interface: '' }
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

// ── Factories ──────────────────────────────────────────────────────────────────

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

// ── Serialization: form ↔ version ────────────────────────────────────────────────

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
  it('maps a loaded version into form values (External → Enabled form)', () => {
    const values = toDraftFormValues(loadedVersion())
    expect(values.AdminNote).toBe('wip')
    expect(values.RegenerateFlagsOnPublish).toBe(true)
    expect(values.Variants[0].ID).toBe('var1')
    expect(values.Variants[0].Tasks[0].ID).toBe('task1')
    expect(values.Variants[0].Topology.Devices[0].External)
      .toEqual({ Enabled: true, Port: 8080, Protocol: 'https' })
  })

  it('null version → empty draft (1 variant, 1 task)', () => {
    const values = toDraftFormValues(null)
    expect(values.Variants).toHaveLength(1)
    expect(values.Variants[0].Tasks).toHaveLength(1)
  })
})

describe('toSaveDraftInput', () => {
  it('round-trips a loaded version 1:1 (saved IDs go back out)', () => {
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

  it('new entities go out without an ID (except devices), Index is renumbered', () => {
    const draft = emptyDraft()
    draft.Variants[0].Tasks[0].Name = 'New task'
    const second = emptyVariant(99) // decorative Index is ignored
    second.Tasks[0].Name = 'New task'
    draft.Variants.push(second)
    const input = toSaveDraftInput(draft)
    expect(input.Variants[0].ID).toBeUndefined()
    expect(input.Variants[0].Tasks[0].ID).toBeUndefined()
    expect(input.Variants[0].Index).toBe(1)
    expect(input.Variants[1].Index).toBe(2)
  })

  it('a bare switch goes out bare, disabled External is omitted, null Description is omitted', () => {
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
