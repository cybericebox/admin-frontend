/**
 * VersionsTable.test.tsx — version rows, status-driven actions, author resolution.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))
vi.mock('@/lib/useRole', () => ({
  useRole: () => ({ me: null, role: 'admin', isLoading: false, permissions: ['*'], can: () => true }),
}))
vi.mock('@/lib/userNames', () => ({
  useUserNames: () => ({
    u1: { id: 'u1', name: 'Ann Lee', href: '/users/detail?id=u1' },
  }),
}))

import { VersionsTable } from './VersionsTable'
import type { VersionListItem } from '@/api/exercises/versions'

const EX_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

function version(over: Partial<VersionListItem>): VersionListItem {
  return {
    ID: 'v1',
    Status: 'draft',
    AdminNote: 'note',
    VariantCount: 2,
    CreatedAt: '2026-01-01T00:00:00Z',
    CreatedBy: 'u1',
    PublishedAt: null,
    ...over,
  }
}

describe('VersionsTable', () => {
  const onPublish = vi.fn()
  const onDiscard = vi.fn()
  const onRollback = vi.fn()
  beforeEach(() => vi.clearAllMocks())

  function renderTable(versions: VersionListItem[]) {
    return render(
      <VersionsTable
        exerciseId={EX_ID}
        versions={versions}
        busy={false}
        onPublish={onPublish}
        onDiscard={onDiscard}
        onRollback={onRollback}
      />,
    )
  }

  it('draft row: edit link + publish + discard, author name resolved', () => {
    renderTable([version({ Status: 'draft' })])
    expect(screen.getByText('Ann Lee')).toBeInTheDocument()
    expect(screen.getByText('admin.exVersions.edit').closest('a'))
      .toHaveAttribute('href', `/exercises/draft?id=${EX_ID}`)
    fireEvent.click(screen.getByText('admin.exDetail.publish'))
    expect(onPublish).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByText('admin.exDetail.discard'))
    expect(onDiscard).toHaveBeenCalledOnce()
  })

  it('unpublished row: rollback + view link with versionId, no draft-only actions', () => {
    renderTable([version({ ID: 'v2', Status: 'unpublished', PublishedAt: '2026-01-05T00:00:00Z' })])
    fireEvent.click(screen.getByText('admin.exVersions.rollback'))
    expect(onRollback).toHaveBeenCalledWith('v2')
    expect(screen.getByText('admin.exVersions.view').closest('a'))
      .toHaveAttribute('href', `/exercises/draft?id=${EX_ID}&versionId=v2`)
    // Draft-only actions must be absent on an unpublished row.
    expect(screen.queryByText('admin.exVersions.edit')).not.toBeInTheDocument()
    expect(screen.queryByText('admin.exDetail.publish')).not.toBeInTheDocument()
    expect(screen.queryByText('admin.exDetail.discard')).not.toBeInTheDocument()
  })

  it('published row: view only (no rollback/publish/discard)', () => {
    renderTable([version({ ID: 'v3', Status: 'published' })])
    expect(screen.queryByText('admin.exVersions.rollback')).not.toBeInTheDocument()
    expect(screen.queryByText('admin.exDetail.publish')).not.toBeInTheDocument()
    expect(screen.getByText('admin.exVersions.view')).toBeInTheDocument()
  })
})
