/**
 * test.ts — sendTestNotification API wrapper for sending test notifications to the current admin user.
 *
 * Backend contract (SP1): POST /api/notifications/test
 * Body: { Type: string; Channels: string[]; Variables: Record<string,string>; TemplateID?: string }
 */

import { apiPost } from '@/api/client'

export type TestSendInput = {
  Type: string
  Channels: string[]
  Variables: Record<string, string>
  TemplateID?: string
}

/**
 * sendTestNotification sends a test notification to the current admin user.
 * Omits TemplateID from the POST body when undefined.
 */
export async function sendTestNotification(input: TestSendInput): Promise<void> {
  const body = {
    Type: input.Type,
    Channels: input.Channels,
    Variables: input.Variables,
    ...(input.TemplateID ? { TemplateID: input.TemplateID } : {}),
  }

  return apiPost<void>('/api/notifications/test', body)
}
