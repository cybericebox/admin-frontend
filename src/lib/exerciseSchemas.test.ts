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
    ['02:42-ac:11:00:02', false], // смешанные разделители: net.ParseMAC отвергает
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
    ['010.0.0.0/24', false], // ведущий ноль в октете: Go netip отвергает
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
    ['010.0.0.1', false], // ведущий ноль в октете: Go netip отвергает
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
