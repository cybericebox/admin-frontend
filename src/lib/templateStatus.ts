export type TemplateStatus = 'draft' | 'published' | 'unpublished';

/**
 * Determines the effective status of a template based on Draft/Published/Unpublished fields.
 * Precedence: Published > Draft > Unpublished
 *
 * @param entry Object with Draft, Published, Unpublished fields (any can be null)
 * @returns "published" if Published is non-null,
 *          "draft" if Draft is non-null (and Published is null),
 *          "unpublished" if Unpublished is non-null (and Draft & Published are null),
 *          null if all fields are null
 */
export function effectiveStatus(entry: {
  Draft: unknown | null;
  Published: unknown | null;
  Unpublished: unknown | null;
}): TemplateStatus | null {
  if (entry.Published !== null) {
    return 'published';
  }
  if (entry.Draft !== null) {
    return 'draft';
  }
  if (entry.Unpublished !== null) {
    return 'unpublished';
  }
  return null;
}

/**
 * Checks if a draft is pending (i.e., both Published and Draft versions exist).
 *
 * @param entry Object with Draft and Published fields (any can be null)
 * @returns true if both Published and Draft are non-null, false otherwise
 */
export function hasDraftPending(entry: {
  Draft: unknown | null;
  Published: unknown | null;
}): boolean {
  return entry.Published !== null && entry.Draft !== null;
}

/**
 * Maps a raw status string to an i18n translation key.
 *
 * Known mappings:
 * - "draft" → "admin.notif.status.draft"
 * - "published" → "admin.notif.status.published"
 * - "unpublished" → "admin.notif.status.unpublished"
 * - "active" (legacy) → "admin.notif.status.published"
 * - dispatch statuses: "pending", "started", "done", "error" → "admin.notif.status.<value>"
 *
 * For unknown statuses, returns the status unchanged (passthrough).
 *
 * @param status The raw status string
 * @returns The i18n key, or the original status if not recognized
 */
export function statusLabelKey(status: string): string {
  const keyMap: Record<string, string> = {
    draft: 'admin.notif.status.draft',
    published: 'admin.notif.status.published',
    unpublished: 'admin.notif.status.unpublished',
    active: 'admin.notif.status.published', // legacy
    pending: 'admin.notif.status.pending',
    started: 'admin.notif.status.started',
    done: 'admin.notif.status.done',
    error: 'admin.notif.status.error',
  };

  return keyMap[status] ?? status;
}
