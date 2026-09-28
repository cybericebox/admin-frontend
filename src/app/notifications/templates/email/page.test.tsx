/**
 * page.test.tsx — TDD tests for the email templates grouped list page.
 *
 * Covers:
 *  - Renders a row for each LatestEntry (type name, status, draft-pending badge,
 *    updated-by name link, row link to detail)
 *  - pickVersion prefers Draft when both Draft and Published exist → row href
 *    uses the Draft's ID
 *  - Empty state renders when latestEmailTemplates returns []
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import type { LatestEntry } from '@/api/notifications/emailTemplates'

// ── Module mocks ──────────────────────────────────────────────────────────────

// i18n — return key as value so tests are language-agnostic
vi.mock('@/i18n/t', () => ({
  t: (key: string) => key,
}))

// useRole — grant all permissions so RequirePermission passes
vi.mock('@/lib/useRole', () => ({
  useRole: () => ({
    me: null,
    role: 'super_admin',
    isLoading: false,
    permissions: ['*'],
    can: () => true,
  }),
}))

// API module
vi.mock('@/api/notifications/emailTemplates', () => ({
  latestEmailTemplates: vi.fn(),
}))

// useUserNames — deterministic resolution for test user IDs
vi.mock('@/lib/userNames', () => ({
  useUserNames: (ids: (string | null | undefined)[]) => {
    const map: Record<string, { id: string; name: string; href: string }> = {
      u1: { id: 'u1', name: 'Ann Lee', href: '/users/detail?id=u1' },
    }
    // Return only the ids that are in the mock map
    const result: Record<string, { id: string; name: string; href: string }> = {}
    for (const id of ids) {
      if (id && map[id]) result[id] = map[id]
    }
    return result
  },
}))

// ── Import the API mock so we can configure it per-test ───────────────────────
import { latestEmailTemplates } from '@/api/notifications/emailTemplates'

// ── Import component AFTER all mocks ──────────────────────────────────────────
import Page from './page'

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** An entry with both Published and Draft versions present. */
function makeEntryWithDraftAndPublished(): LatestEntry {
  return {
    NotificationType: 'user.account_created',
    Published: {
      ID: 'pub-1',
      NotificationType: 'user.account_created',
      Status: 'published',
      Subject: 'Welcome!',
      Preheader: '',
      Body: [],
      Styling: {},
      PublishedAt: '2024-06-01T00:00:00Z',
      UpdatedByUserID: 'u1',
      CreatedAt: '2024-06-01T00:00:00Z',
      UpdatedAt: '2024-06-01T00:00:00Z',
    },
    Draft: {
      ID: 'd1',
      NotificationType: 'user.account_created',
      Status: 'draft',
      Subject: 'Welcome (draft)!',
      Preheader: '',
      Body: [],
      Styling: {},
      PublishedAt: null,
      UpdatedByUserID: 'u1',
      CreatedAt: '2024-06-02T00:00:00Z',
      UpdatedAt: '2024-06-02T00:00:00Z',
    },
    Unpublished: null,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Email templates grouped list page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without throwing', () => {
    vi.mocked(latestEmailTemplates).mockResolvedValue([])
    expect(() => render(<Page />)).not.toThrow()
  })

  it('renders the formatted type name from the entry', async () => {
    vi.mocked(latestEmailTemplates).mockResolvedValue([makeEntryWithDraftAndPublished()])
    render(<Page />)
    // formatNotifType('user.account_created') → 'User Account Created'
    await waitFor(() => {
      expect(screen.getByText('User Account Created')).toBeInTheDocument()
    })
  })

  it('renders a translated status label for the effective status (published)', async () => {
    vi.mocked(latestEmailTemplates).mockResolvedValue([makeEntryWithDraftAndPublished()])
    render(<Page />)
    // effectiveStatus sees Published → 'published'; statusLabelKey → 'admin.notif.status.published'
    // t() mocked to return key as-is
    await waitFor(() => {
      expect(screen.getByText('admin.notif.status.published')).toBeInTheDocument()
    })
  })

  it('renders a draft-pending badge when both Published and Draft exist', async () => {
    vi.mocked(latestEmailTemplates).mockResolvedValue([makeEntryWithDraftAndPublished()])
    render(<Page />)
    // hasDraftPending → true → badge shows t('admin.notif.list.draftPending')
    await waitFor(() => {
      expect(screen.getByText('admin.notif.list.draftPending')).toBeInTheDocument()
    })
  })

  it('renders "Ann Lee" linking to /users/detail?id=u1 for UpdatedByUserID u1', async () => {
    vi.mocked(latestEmailTemplates).mockResolvedValue([makeEntryWithDraftAndPublished()])
    render(<Page />)
    await waitFor(() => {
      const link = screen.getByRole('link', { name: 'Ann Lee' })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', '/users/detail?id=u1')
    })
  })

  it('row link href targets the Draft ID (pickVersion prefers Draft)', async () => {
    vi.mocked(latestEmailTemplates).mockResolvedValue([makeEntryWithDraftAndPublished()])
    render(<Page />)
    // pickVersion = Draft ?? Published ?? Unpublished → Draft.ID = 'd1'
    await waitFor(() => {
      const rowLink = document.querySelector(
        `a[href="/notifications/templates/email/detail?id=d1"]`,
      )
      expect(rowLink).not.toBeNull()
    })
  })

  it('renders the empty state when latestEmailTemplates returns []', async () => {
    vi.mocked(latestEmailTemplates).mockResolvedValue([])
    render(<Page />)
    await waitFor(() => {
      expect(screen.getByText('admin.notif.list.empty')).toBeInTheDocument()
    })
  })

  it('shows loading indicator while latestEmailTemplates is pending', async () => {
    // Return a promise that never resolves — component stays in loading state
    vi.mocked(latestEmailTemplates).mockReturnValue(new Promise(() => {}))
    render(<Page />)
    // Loading state renders immediately on mount (entries===null, loadError===false)
    // t('admin.loading') → 'admin.loading'
    await waitFor(() => {
      expect(screen.getByText('admin.loading')).toBeInTheDocument()
    })
  })

  it('shows loadError message when latestEmailTemplates rejects', async () => {
    vi.mocked(latestEmailTemplates).mockRejectedValue(new Error('network error'))
    render(<Page />)
    // Wait for the catch handler to fire and set loadError=true
    // t('admin.notif.list.loadError') → 'admin.notif.list.loadError'
    await waitFor(() => {
      expect(screen.getByText('admin.notif.list.loadError')).toBeInTheDocument()
    })
  })

  it('row link targets the create affordance when entry has no versions', async () => {
    const entryNoVersions: LatestEntry = {
      NotificationType: 'user.password_reset',
      Draft: null,
      Published: null,
      Unpublished: null,
    }
    vi.mocked(latestEmailTemplates).mockResolvedValue([entryNoVersions])
    render(<Page />)
    // Missing templates open a new editor with the type already selected.
    await waitFor(() => {
      const createLink = document.querySelector(
        `a[href="/notifications/templates/email/detail?type=user.password_reset"]`,
      )
      expect(createLink).not.toBeNull()
      expect(screen.getByText('admin.notif.tpl.notConfigured')).toBeInTheDocument()
    })
  })
})
