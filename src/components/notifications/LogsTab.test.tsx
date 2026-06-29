/**
 * LogsTab.test.tsx — TDD RED→GREEN
 *
 * Covers:
 *  - Recipient renders as "Ann Lee" link to /users/detail?id=u1 (not raw id)
 *  - Status pill shows translated i18n key (admin.notif.status.done), not raw "done"
 *  - Clicking the filter affordance causes subsequent fetch with user=u1 and
 *    shows a "filtered by Ann Lee" chip
 *  - Clicking the chip's ✕ clears the filter (user= removed from next fetch)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// ── Mocks (hoisted before imports) ────────────────────────────────────────────

// i18n — return key as value so tests are language-agnostic
vi.mock('@/i18n/t', () => ({
  t: (key: string) => key,
}))

// API client — control all responses per test
vi.mock('@/api/client', () => ({
  apiGet: vi.fn(),
}))

// useUserNames — deterministic, synchronous resolution
vi.mock('@/lib/userNames', () => ({
  useUserNames: (ids: (string | null | undefined)[]) => {
    const map: Record<string, { id: string; name: string; href: string }> = {
      u1: { id: 'u1', name: 'Ann Lee', href: '/users/detail?id=u1' },
    }
    const result: Record<string, { id: string; name: string; href: string }> = {}
    for (const id of ids) {
      if (id && map[id]) result[id] = map[id]
    }
    return result
  },
}))

// next/link — render a plain <a> so href / onClick are testable in jsdom
vi.mock('next/link', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: ({ href, children, onClick }: any) => (
    <a href={href} onClick={onClick}>{children}</a>
  ),
}))

// ── Module imports (after mocks) ──────────────────────────────────────────────

import { apiGet } from '@/api/client'
import { LogsTab } from './LogsTab'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DISPATCH_ROW = {
  ID: 'x',
  NotificationType: 'user.welcome',
  RecipientUserID: 'u1',
  Status: 'done',
  CreatedAt: '2026-06-01T00:00:00Z',
  UpdatedAt: '2026-06-01T00:00:00Z',
}

const LIST_RESPONSE = { Dispatches: [DISPATCH_ROW], Total: 1 }

const DETAIL_RESPONSE = {
  ...DISPATCH_ROW,
  Targets: [
    { Channel: 'email', Status: 'done', Error: '', Attempts: 1, UpdatedAt: '2026-06-01T00:00:00Z' },
  ],
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LogsTab', () => {
  const mockApiGet = vi.mocked(apiGet)

  beforeEach(() => {
    vi.clearAllMocks()
    mockApiGet.mockImplementation((url: string) => {
      if (url.startsWith('/api/notifications/dispatches/')) {
        return Promise.resolve(DETAIL_RESPONSE)
      }
      return Promise.resolve(LIST_RESPONSE)
    })
  })

  it('renders without throwing', () => {
    expect(() => render(<LogsTab />)).not.toThrow()
  })

  it('renders "Ann Lee" as a link to /users/detail?id=u1 (not raw id)', async () => {
    render(<LogsTab />)
    await waitFor(() => {
      const link = screen.getByRole('link', { name: 'Ann Lee' })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', '/users/detail?id=u1')
    })
    // Raw truncated id must NOT appear as visible text
    expect(screen.queryByText('u1'.slice(0, 8))).not.toBeInTheDocument()
  })

  it('status pill shows translated label (admin.notif.status.done), not raw "done"', async () => {
    render(<LogsTab />)
    await waitFor(() => {
      // t is mocked to return the key; statusLabelKey('done') → 'admin.notif.status.done'
      const translated = screen.getAllByText('admin.notif.status.done')
      expect(translated.length).toBeGreaterThanOrEqual(1)
    })
    // Raw 'done' must not appear as standalone text content
    expect(screen.queryByText('done')).not.toBeInTheDocument()
  })

  it('clicking the filter affordance triggers a fetch with user=u1 and shows chip', async () => {
    render(<LogsTab />)
    // Wait for the recipient row to render
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Ann Lee' })).toBeInTheDocument()
    })

    // Clear calls from the initial list fetch
    mockApiGet.mockClear()

    // Click the per-row filter button (aria-label = the i18n key, since t returns key)
    const filterBtn = screen.getByRole('button', { name: 'admin.notif.logs.filterByUser' })
    fireEvent.click(filterBtn)

    // The next fetch must include user=u1
    await waitFor(() => {
      const calls = mockApiGet.mock.calls as [string, ...unknown[]][]
      const hit = calls.find(([url]) => (url as string).includes('user=u1'))
      expect(hit).toBeTruthy()
    })

    // A "filtered by" chip must be visible
    await waitFor(() => {
      expect(document.body.textContent).toContain('admin.notif.logs.filteredBy')
      expect(document.body.textContent).toContain('Ann Lee')
    })
  })

  it('clicking chip ✕ clears the filter and removes user= from subsequent fetch', async () => {
    render(<LogsTab />)
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Ann Lee' })).toBeInTheDocument()
    })

    // Activate user filter
    fireEvent.click(screen.getByRole('button', { name: 'admin.notif.logs.filterByUser' }))

    // Wait for chip to appear and data to settle
    await waitFor(() => {
      expect(document.body.textContent).toContain('admin.notif.logs.filteredBy')
    })

    // Clear calls accumulated so far, then dismiss chip
    mockApiGet.mockClear()
    fireEvent.click(screen.getByRole('button', { name: '✕' }))

    // Chip must disappear immediately
    expect(document.body.textContent).not.toContain('admin.notif.logs.filteredBy')

    // Subsequent fetch must NOT include user=
    await waitFor(() => {
      const calls = mockApiGet.mock.calls as [string, ...unknown[]][]
      expect(calls.length).toBeGreaterThan(0)
      expect(calls.every(([url]) => !(url as string).includes('user='))).toBe(true)
    })
  })
})
