/**
 * test.test.ts — TDD RED→GREEN for sendTestNotification API wrapper.
 *
 * vi.mock('@/api/client') intercepts all apiPost calls.
 * Tests pin the exact body structure and TemplateID omission behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the client BEFORE importing the module under test.
vi.mock('@/api/client')

import * as client from '@/api/client'
import { sendTestNotification, type TestSendInput } from './test'

const mockApiPost = vi.mocked(client.apiPost)

// ── sendTestNotification ───────────────────────────────────────────────────────

describe('sendTestNotification', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls apiPost with the correct path', async () => {
    mockApiPost.mockResolvedValueOnce(undefined)
    const input: TestSendInput = {
      Type: 'user_invitation',
      Channels: ['email'],
      Variables: { InviteURL: 'https://example.com/invite' },
    }
    await sendTestNotification(input)
    expect(mockApiPost).toHaveBeenCalledOnce()
    const [path] = mockApiPost.mock.calls[0]
    expect(path).toBe('/api/notifications/test')
  })

  it('omits TemplateID from body when undefined', async () => {
    mockApiPost.mockResolvedValueOnce(undefined)
    const input: TestSendInput = {
      Type: 'user_invitation',
      Channels: ['email'],
      Variables: { InviteURL: 'https://example.com/invite' },
    }
    await sendTestNotification(input)
    expect(mockApiPost).toHaveBeenCalledOnce()
    const [, body] = mockApiPost.mock.calls[0]
    expect(body).toEqual({
      Type: 'user_invitation',
      Channels: ['email'],
      Variables: { InviteURL: 'https://example.com/invite' },
    })
    expect(body).not.toHaveProperty('TemplateID')
  })

  it('includes TemplateID in body when provided', async () => {
    mockApiPost.mockResolvedValueOnce(undefined)
    const input: TestSendInput = {
      Type: 'user_invitation',
      Channels: ['email'],
      Variables: { InviteURL: 'https://example.com/invite' },
      TemplateID: 't1',
    }
    await sendTestNotification(input)
    expect(mockApiPost).toHaveBeenCalledOnce()
    const [, body] = mockApiPost.mock.calls[0]
    expect(body).toEqual({
      Type: 'user_invitation',
      Channels: ['email'],
      Variables: { InviteURL: 'https://example.com/invite' },
      TemplateID: 't1',
    })
  })

  it('resolves to void', async () => {
    mockApiPost.mockResolvedValueOnce(undefined)
    const input: TestSendInput = {
      Type: 'user_invitation',
      Channels: ['email'],
      Variables: { InviteURL: 'https://example.com/invite' },
    }
    const result = await sendTestNotification(input)
    expect(result).toBeUndefined()
  })
})
