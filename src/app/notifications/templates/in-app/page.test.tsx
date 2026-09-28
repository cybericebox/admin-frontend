/**
 * page.test.tsx — TDD tests for the in-app templates grouped list page (SP5 Task 4).
 *
 * Covers:
 *  - Renders a row for each InAppLatestEntry (type name, status, draft-pending badge,
 *    updated-by name link, row link to detail)
 *  - pickVersion prefers Draft when both Draft and Published exist → row href
 *    uses the Draft's ID
 *  - Empty state renders when latestInAppTemplates returns []
 *  - Row link targets the create affordance when entry has all-null versions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import type { InAppLatestEntry } from '@/api/notifications/inAppTemplates'

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
vi.mock('@/api/notifications/inAppTemplates', () => ({
  latestInAppTemplates: vi.fn(),
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
import { latestInAppTemplates } from '@/api/notifications/inAppTemplates'

// ── Import component AFTER all mocks ──────────────────────────────────────────
import Page from './page'

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** An entry with both Published and Draft versions present. */
function makeEntryWithDraftAndPublished(): InAppLatestEntry {
  return {
    NotificationType: 'user.account_created',
    Published: {
      ID: 'pub-1',
      NotificationType: 'user.account_created',
      Status: 'published',
      Title: 'Welcome!',
      Body: '',
      Link: '',
      Icon: '',
      Tone: '',
      AccentColor: '',
      Surface: '',
      AutoDismissMs: null,
      Dismissible: true,
      Actions: [],
      PublishedAt: '2024-06-01T00:00:00Z',
      UpdatedByUserID: 'u1',
      CreatedAt: '2024-06-01T00:00:00Z',
      UpdatedAt: '2024-06-01T00:00:00Z',
    },
    Draft: {
      ID: 'd1',
      NotificationType: 'user.account_created',
      Status: 'draft',
      Title: 'Welcome (draft)!',
      Body: '',
      Link: '',
      Icon: '',
      Tone: '',
      AccentColor: '',
      Surface: '',
      AutoDismissMs: null,
      Dismissible: true,
      Actions: [],
      PublishedAt: null,
      UpdatedByUserID: 'u1',
      CreatedAt: '2024-06-02T00:00:00Z',
      UpdatedAt: '2024-06-02T00:00:00Z',
    },
    Unpublished: null,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('In-app templates grouped list page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without throwing', () => {
    vi.mocked(latestInAppTemplates).mockResolvedValue([])
    expect(() => render(<Page />)).not.toThrow()
  })

  it('renders the formatted type name from the entry', async () => {
    vi.mocked(latestInAppTemplates).mockResolvedValue([makeEntryWithDraftAndPublished()])
    render(<Page />)
    // formatNotifType('user.account_created') → 'User Account Created'
    await waitFor(() => {
      expect(screen.getByText('User Account Created')).toBeInTheDocument()
    })
  })

  it('renders a translated status label for the effective status (published)', async () => {
    vi.mocked(latestInAppTemplates).mockResolvedValue([makeEntryWithDraftAndPublished()])
    render(<Page />)
    // effectiveStatus sees Published → 'published'; statusLabelKey → 'admin.notif.status.published'
    // t() mocked to return key as-is
    await waitFor(() => {
      expect(screen.getByText('admin.notif.status.published')).toBeInTheDocument()
    })
  })

  it('renders a draft-pending badge when both Published and Draft exist', async () => {
    vi.mocked(latestInAppTemplates).mockResolvedValue([makeEntryWithDraftAndPublished()])
    render(<Page />)
    // hasDraftPending → true → badge shows t('admin.notif.list.draftPending')
    await waitFor(() => {
      expect(screen.getByText('admin.notif.list.draftPending')).toBeInTheDocument()
    })
  })

  it('renders "Ann Lee" linking to /users/detail?id=u1 for UpdatedByUserID u1', async () => {
    vi.mocked(latestInAppTemplates).mockResolvedValue([makeEntryWithDraftAndPublished()])
    render(<Page />)
    await waitFor(() => {
      const link = screen.getByRole('link', { name: 'Ann Lee' })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', '/users/detail?id=u1')
    })
  })

  it('row link href targets the Draft ID (pickVersion prefers Draft)', async () => {
    vi.mocked(latestInAppTemplates).mockResolvedValue([makeEntryWithDraftAndPublished()])
    render(<Page />)
    // pickVersion = Draft ?? Published ?? Unpublished → Draft.ID = 'd1'
    await waitFor(() => {
      const rowLink = document.querySelector(
        `a[href="/notifications/templates/in-app/detail?id=d1"]`,
      )
      expect(rowLink).not.toBeNull()
    })
  })

  it('renders the empty state when latestInAppTemplates returns []', async () => {
    vi.mocked(latestInAppTemplates).mockResolvedValue([])
    render(<Page />)
    await waitFor(() => {
      expect(screen.getByText('admin.notif.inapp.list.empty')).toBeInTheDocument()
    })
  })

  it('row link targets the create affordance when entry has no versions', async () => {
    const entryNoVersions: InAppLatestEntry = {
      NotificationType: 'user.password_reset',
      Draft: null,
      Published: null,
      Unpublished: null,
    }
    vi.mocked(latestInAppTemplates).mockResolvedValue([entryNoVersions])
    render(<Page />)
    // Missing templates open a new editor with the type already selected.
    await waitFor(() => {
      const createLink = document.querySelector(
        `a[href="/notifications/templates/in-app/detail?type=user.password_reset"]`,
      )
      expect(createLink).not.toBeNull()
      expect(screen.getByText('admin.notif.tpl.notConfigured')).toBeInTheDocument()
    })
  })
})
