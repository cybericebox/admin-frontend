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

// useRole — events.read unlocks the event filter (listEvents)
vi.mock('@/lib/useRole', () => ({
  useRole: () => ({ can: (perm: string) => perm === 'events.read' }),
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

const LIST_RESPONSE = { Items: [DISPATCH_ROW], Total: 1, Page: 1, PageSize: 25 }

const DETAIL_RESPONSE = {
  ...DISPATCH_ROW,
  Targets: [
    { Channel: 'email', Status: 'done', Error: '', Attempts: 1, UpdatedAt: '2026-06-01T00:00:00Z' },
  ],
}

const EVENTS_RESPONSE = { Items: [{ ID: 'ev-1', Name: 'Kyiv CTF', Tag: 'kyiv' }], Total: 1 }

const JOURNAL_ROWS = [
  {
    ...DISPATCH_ROW,
    ID: 'j1',
    ScopeEventID: 'ev-1',
    EventName: 'Kyiv CTF',
    RecipientEmail: 'ann@example.com',
    Targets: [
      { Channel: 'email', Status: 'done', Error: '', Attempts: 2, Transport: 'platform', Recipient: 'ann@example.com', FallbackError: 'dial tcp: timeout', UpdatedAt: '2026-06-01T00:00:00Z' },
      { Channel: 'in_app', Status: 'done', Error: '', Attempts: 1, Transport: '', Recipient: '', FallbackError: '', UpdatedAt: '2026-06-01T00:00:00Z' },
    ],
  },
  {
    ...DISPATCH_ROW,
    ID: 'j2',
    ScopeEventID: null,
    EventName: '',
    RecipientEmail: 'bob@example.com',
    Targets: [
      { Channel: 'email', Status: 'error', Error: 'mail is not configured', Attempts: 3, Transport: 'env', Recipient: 'bob@example.com', FallbackError: '', UpdatedAt: '2026-06-01T00:00:00Z' },
    ],
  },
]

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LogsTab', () => {
  const mockApiGet = vi.mocked(apiGet)

  beforeEach(() => {
    vi.clearAllMocks()
    mockApiGet.mockImplementation((url: string) => {
      if (url.startsWith('/api/notifications/dispatches/')) {
        return Promise.resolve(DETAIL_RESPONSE)
      }
      if (url.startsWith('/api/events')) return Promise.resolve(EVENTS_RESPONSE)
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
      expect(document.body.textContent).toContain('admin.notif.logs.filteredByName')
      expect(document.body.textContent).toContain('Ann Lee')
    })
  })

  it('detail dialog target pill shows translated status label for error status', async () => {
    // Override mock to return a detail with one target whose Status is 'error'
    mockApiGet.mockImplementation((url: string) => {
      if (url.startsWith('/api/notifications/dispatches/')) {
        return Promise.resolve({
          ...DISPATCH_ROW,
          Targets: [
            { Channel: 'email', Status: 'error', Error: 'x', Attempts: 1, UpdatedAt: '2026-06-01T00:00:00Z' },
          ],
        })
      }
      return Promise.resolve(LIST_RESPONSE)
    })

    render(<LogsTab />)

    // Wait for the list to load and render the row
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Ann Lee' })).toBeInTheDocument()
    })

    // Click the first table row to open the detail dialog
    // The row onClick is on <tr>; find the type cell and go up to its <tr>
    const typeCell = screen.getAllByRole('cell')[0]
    fireEvent.click(typeCell.closest('tr')!)

    // Wait for the dialog to show the target status pill with the translated label
    // t('admin.notif.status.error') → 'admin.notif.status.error' (t mocked to return key)
    await waitFor(() => {
      expect(screen.getByText('admin.notif.status.error')).toBeInTheDocument()
    })

    // Raw 'error' string must not appear standalone as visible text
    expect(screen.queryByText('error')).not.toBeInTheDocument()
  })

  it('a deferred target shows the deferred label and its reason', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.startsWith('/api/notifications/dispatches/')) {
        return Promise.resolve({
          ...DISPATCH_ROW,
          Targets: [
            { Channel: 'email', Status: 'deferred', Error: 'Відкладено: вичерпано добовий ліміт', Attempts: 0, UpdatedAt: '2026-06-01T00:00:00Z' },
          ],
        })
      }
      return Promise.resolve(LIST_RESPONSE)
    })

    render(<LogsTab />)
    await waitFor(() => expect(screen.getByRole('link', { name: 'Ann Lee' })).toBeInTheDocument())
    fireEvent.click(screen.getAllByRole('cell')[0].closest('tr')!)

    await waitFor(() => expect(screen.getByText('admin.notif.status.deferred')).toBeInTheDocument())
    expect(screen.getByText(/Відкладено: вичерпано добовий ліміт/)).toBeInTheDocument()
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
      expect(document.body.textContent).toContain('admin.notif.logs.filteredByName')
    })

    // Clear calls accumulated so far, then dismiss chip
    mockApiGet.mockClear()
    fireEvent.click(screen.getByRole('button', { name: '✕' }))

    // Chip must disappear immediately
    expect(document.body.textContent).not.toContain('admin.notif.logs.filteredByName')

    // Subsequent fetch must NOT include user=
    await waitFor(() => {
      const calls = mockApiGet.mock.calls as [string, ...unknown[]][]
      expect(calls.length).toBeGreaterThan(0)
      expect(calls.every(([url]) => !(url as string).includes('user='))).toBe(true)
    })
  })

  it('requests the next cursor page', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.endsWith('/types')) return Promise.resolve([])
      if (url.includes('cursor=next-id')) return Promise.resolve({ Items: [DISPATCH_ROW], Total: 50 })
      return Promise.resolve({ Items: [DISPATCH_ROW], Total: 50, NextCursor: 'next-id' })
    })
    render(<LogsTab />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'admin.table.next' })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: 'admin.table.next' }))
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('cursor=next-id')))
    expect(screen.getByText('admin.table.pageOf')).toBeInTheDocument()
  })

  it('renders journal columns: email, event name, transport, fallback and error', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.startsWith('/api/events')) return Promise.resolve(EVENTS_RESPONSE)
      return Promise.resolve({ Items: JOURNAL_ROWS, Total: 2 })
    })
    render(<LogsTab />)
    expect(await screen.findByText('ann@example.com')).toBeInTheDocument()
    expect(screen.getByText('bob@example.com')).toBeInTheDocument()
    const rows = screen.getAllByRole('row')
    expect(rows[1].textContent).toContain('Kyiv CTF')
    expect(rows[1].textContent).toContain('platform')
    expect(rows[1].textContent).toContain('admin.notif.logs.fallbackPrefix')
    expect(rows[2].querySelectorAll('td')[2].textContent).toBe('—')
    expect(rows[2].textContent).toContain('env')
    expect(rows[2].textContent).toContain('mail is not configured')
  })

  it('sends channel, result, transport and event filters to the API', async () => {
    render(<LogsTab />)
    await screen.findByRole('link', { name: 'Ann Lee' })
    const pick = async (filter: string, option: string) => {
      fireEvent.keyDown(screen.getByRole('button', { name: filter }), { key: 'ArrowDown' })
      fireEvent.click(await screen.findByRole('menuitemradio', { name: option }))
    }
    await pick('admin.notif.logs.channel', 'email')
    await pick('admin.notif.logs.result', 'admin.notif.logs.resultError')
    await pick('admin.notif.logs.transport', 'event')
    await pick('admin.notif.logs.event', 'Kyiv CTF')
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/notifications\/dispatches\?(?=.*event=ev-1)(?=.*channel=email)(?=.*result=error)(?=.*transport=event)/),
    ))
    expect(mockApiGet).toHaveBeenCalledWith('/api/events?pageSize=100')
  })

  it('marks SMTP test rows with a badge and filters them by type', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.startsWith('/api/events')) return Promise.resolve(EVENTS_RESPONSE)
      if (url.startsWith('/api/notifications/dispatches')) {
        return Promise.resolve({
          ...LIST_RESPONSE,
          Items: [
            { ...DISPATCH_ROW, ID: 't1', NotificationType: 'smtp_test', RecipientEmail: 'ann@example.com', Targets: [] },
            { ...DISPATCH_ROW, ID: 't2', NotificationType: 'password_reset', Targets: [] },
          ],
        })
      }
      return Promise.resolve([])
    })
    render(<LogsTab />)
    await waitFor(() => expect(screen.getAllByText('admin.notif.logs.testBadge')).toHaveLength(1))
    fireEvent.keyDown(screen.getByRole('button', { name: 'admin.notif.logs.type' }), { key: 'ArrowDown' })
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Smtp Test' }))
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/notifications\/dispatches\?(?=.*type=smtp_test)/),
    ))
  })
})
