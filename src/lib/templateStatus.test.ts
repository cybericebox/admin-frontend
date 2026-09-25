import { describe, it, expect } from 'vitest';
import {
  effectiveStatus,
  hasDraftPending,
  statusLabelKey,
} from './templateStatus';

describe('templateStatus', () => {
  describe('effectiveStatus', () => {
    it('returns "published" when Published is non-null', () => {
      const result = effectiveStatus({
        Draft: null,
        Published: { id: '123' },
        Unpublished: null,
      });
      expect(result).toBe('published');
    });

    it('returns "published" even if Draft is also present', () => {
      const result = effectiveStatus({
        Draft: { id: 'draft-1' },
        Published: { id: '123' },
        Unpublished: null,
      });
      expect(result).toBe('published');
    });

    it('returns "draft" when Published is null but Draft is non-null', () => {
      const result = effectiveStatus({
        Draft: { id: 'draft-1' },
        Published: null,
        Unpublished: null,
      });
      expect(result).toBe('draft');
    });

    it('returns "draft" when Published is null and Unpublished is also present', () => {
      const result = effectiveStatus({
        Draft: { id: 'draft-1' },
        Published: null,
        Unpublished: { id: 'unpublished-1' },
      });
      expect(result).toBe('draft');
    });

    it('returns "unpublished" when Published and Draft are null but Unpublished is non-null', () => {
      const result = effectiveStatus({
        Draft: null,
        Published: null,
        Unpublished: { id: 'unpublished-1' },
      });
      expect(result).toBe('unpublished');
    });

    it('returns null when all fields are null', () => {
      const result = effectiveStatus({
        Draft: null,
        Published: null,
        Unpublished: null,
      });
      expect(result).toBeNull();
    });

    it('treats empty string as falsy and continues to next status', () => {
      const result = effectiveStatus({
        Draft: { id: 'draft-1' },
        Published: null,
        Unpublished: null,
      });
      expect(result).toBe('draft');
    });
  });

  describe('hasDraftPending', () => {
    it('returns true when both Published and Draft are non-null', () => {
      const result = hasDraftPending({
        Draft: { id: 'draft-1' },
        Published: { id: 'published-1' },
      });
      expect(result).toBe(true);
    });

    it('returns false when Draft is null and Published is non-null', () => {
      const result = hasDraftPending({
        Draft: null,
        Published: { id: 'published-1' },
      });
      expect(result).toBe(false);
    });

    it('returns false when Published is null and Draft is non-null', () => {
      const result = hasDraftPending({
        Draft: { id: 'draft-1' },
        Published: null,
      });
      expect(result).toBe(false);
    });

    it('returns false when both Draft and Published are null', () => {
      const result = hasDraftPending({
        Draft: null,
        Published: null,
      });
      expect(result).toBe(false);
    });
  });

  describe('statusLabelKey', () => {
    it('maps "draft" to "admin.notif.status.draft"', () => {
      expect(statusLabelKey('draft')).toBe('admin.notif.status.draft');
    });

    it('maps "published" to "admin.notif.status.published"', () => {
      expect(statusLabelKey('published')).toBe('admin.notif.status.published');
    });

    it('maps "unpublished" to "admin.notif.status.unpublished"', () => {
      expect(statusLabelKey('unpublished')).toBe(
        'admin.notif.status.unpublished'
      );
    });

    it('maps legacy "active" to "admin.notif.status.published"', () => {
      expect(statusLabelKey('active')).toBe('admin.notif.status.published');
    });

    it('maps dispatch status "pending" to "admin.notif.status.pending"', () => {
      expect(statusLabelKey('pending')).toBe('admin.notif.status.pending');
    });

    it('maps dispatch status "started" to "admin.notif.status.started"', () => {
      expect(statusLabelKey('started')).toBe('admin.notif.status.started');
    });

    it('maps dispatch status "done" to "admin.notif.status.done"', () => {
      expect(statusLabelKey('done')).toBe('admin.notif.status.done');
    });

    it('maps dispatch status "error" to "admin.notif.status.error"', () => {
      expect(statusLabelKey('error')).toBe('admin.notif.status.error');
    });

    it('returns unknown status unchanged as passthrough', () => {
      expect(statusLabelKey('unknown-status')).toBe('unknown-status');
    });

    it('returns arbitrary unknown status unchanged', () => {
      expect(statusLabelKey('custom-value')).toBe('custom-value');
    });
  });
});
