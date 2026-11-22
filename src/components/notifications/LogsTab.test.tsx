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
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

// ── Mocks (hoisted before imports) ────────────────────────────────────────────

// i18n — return key as value so tests are language-agnostic
vi.mock('@/i18n/t', () => ({
  t: (key: string) => key,
}))

// API client — control all responses per test
vi.mock('@/api/tablePrefs', () => ({ getTablePrefs: () => Promise.resolve(null), putTablePrefs: () => Promise.resolve({}), deleteTablePrefs: () => Promise.resolve() }))
vi.mock('@/api/client', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
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
  useRole: () => ({ can: (perm: string) => perm === 'events.read' || perm === 'notifications.broadcast' }),
}))

// next/link — render a plain <a> so href / onClick are testable in jsdom
vi.mock('next/link', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: ({ href, children, onClick }: any) => (
    <a href={href} onClick={onClick}>{children}</a>
  ),
}))

// ── Module imports (after mocks) ──────────────────────────────────────────────

import { apiGet, apiPost } from '@/api/client'
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
  const mockApiPost = vi.mocked(apiPost)

  beforeEach(() => {
    vi.clearAllMocks()
    window.history.replaceState(null, '', '/test/')
    window.localStorage.clear()
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

  it('clicking the filter affordance fetches with user=u1 and shows a chip that can be removed', async () => {
    render(<LogsTab />)
    await waitFor(() => expect(screen.getByRole('link', { name: 'Ann Lee' })).toBeInTheDocument())
    mockApiGet.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'admin.notif.logs.filterByUser' }))
    await waitFor(() => expect((mockApiGet.mock.calls as [string][]).some(([url]) => url.includes('user=u1'))).toBe(true))
    expect(screen.getByRole('button', { name: /admin.table.filterEdit/ })).toBeInTheDocument()
    expect(window.location.search).toContain('f.user=is%3Au1')
    mockApiGet.mockClear()
    fireEvent.click(screen.getByRole('button', { name: /admin.table.filterRemove/ }))
    await waitFor(() => {
      const lists = (mockApiGet.mock.calls as [string][]).filter(([url]) => url.startsWith('/api/notifications/dispatches?'))
      expect(lists.length).toBeGreaterThan(0)
      expect(lists.every(([url]) => !url.includes('user='))).toBe(true)
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
    fireEvent.click(within(typeCell.closest('tr')!).getAllByRole('button')[0])

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
    fireEvent.click(within(screen.getAllByRole('cell')[1].closest('tr')!).getAllByRole('button')[0])

    await waitFor(() => expect(screen.getByText('admin.notif.status.deferred')).toBeInTheDocument())
    expect(screen.getByText(/Відкладено: вичерпано добовий ліміт/)).toBeInTheDocument()
  })

  it('pages by offset and keeps the rows while the next page loads', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.endsWith('/types')) return Promise.resolve([])
      return Promise.resolve({ Items: [DISPATCH_ROW], Total: 120 })
    })
    render(<LogsTab />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'admin.table.next' })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: 'admin.table.next' }))
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('page=2')))
    expect(screen.getByRole('link', { name: 'Ann Lee' })).toBeInTheDocument()
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
    expect(rows[2].textContent).toContain('env')
    expect(rows[2].textContent).toContain('mail is not configured')
  })

  it('sends the channel, result, transport, event, recipient and period filters of the address to the API', async () => {
    window.history.replaceState(null, '', '/test/?f.channel=in%3Aemail&f.result=in%3Aerror&f.transport=in%3Aevent&f.event=in%3Aev-1&f.recipient=contains%3Aann&f.period=between%3A2026-10-01%2C2026-10-31')
    render(<LogsTab />)
    await screen.findByRole('link', { name: 'Ann Lee' })
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/notifications\/dispatches\?(?=.*event=ev-1)(?=.*channel=email)(?=.*result=error)(?=.*transport=event)(?=.*recipient=ann)(?=.*from=)(?=.*to=)/),
    ))
  })

  it('marks SMTP test rows with a badge and sends the type filter', async () => {
    window.history.replaceState(null, '', '/test/?f.type=in%3Asmtp_test')
    mockApiGet.mockImplementation((url: string) => {
      if (url.startsWith('/api/events')) return Promise.resolve(EVENTS_RESPONSE)
      if (url.startsWith('/api/notifications/dispatches')) {
        return Promise.resolve({ ...LIST_RESPONSE, Items: [
          { ...DISPATCH_ROW, ID: 't1', NotificationType: 'smtp_test', RecipientEmail: 'ann@example.com', Targets: [] },
          { ...DISPATCH_ROW, ID: 't2', NotificationType: 'password_reset', Targets: [] },
        ] })
      }
      return Promise.resolve([])
    })
    render(<LogsTab />)
    await waitFor(() => expect(screen.getAllByText('admin.notif.logs.testBadge')).toHaveLength(1))
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/notifications\/dispatches\?(?=.*type=smtp_test)/)))
  })

  it('resends the selected failed deliveries after a confirmation; a delivery with no failed channel cannot be selected', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.startsWith('/api/events')) return Promise.resolve(EVENTS_RESPONSE)
      return Promise.resolve({ Items: JOURNAL_ROWS, Total: 2 })
    })
    mockApiPost.mockResolvedValue({ Results: [{ DispatchID: 'j2', Ok: true }] })
    render(<LogsTab />)
    await screen.findByText('bob@example.com')
    const rows = screen.getAllByRole('row')
    expect(within(rows[1]).getByRole('checkbox')).toBeDisabled()
    fireEvent.click(within(rows[2]).getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'admin.notif.logs.resend' }))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'admin.notif.logs.resend.confirm' }))
    await waitFor(() => expect(mockApiPost).toHaveBeenCalledWith('/api/notifications/dispatches/resend', { DispatchIDs: ['j2'] }))
  })
})
