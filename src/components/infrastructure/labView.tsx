"use client"
// Small pieces shared by the stand and test-lab tabs, their detail dialogs and the filters.
import { Badge, type BadgeTone } from "@/components/ui/badge"
import type { Stand, TestLab } from "@/api/infrastructure"
import { t } from "@/i18n/t"

export const STAND_STATUS_FILTERS = ["active", "creating", "ready", "failed", "removed"] as const

const STAND_STATUS_TONE: Record<string, BadgeTone> = { creating: "warn", ready: "ok", failed: "danger", removed: "neutral" }

export function StandStatusBadge({ status }: { status: string }) {
  const known = status in STAND_STATUS_TONE
  return <Badge size="sm" tone={known ? STAND_STATUS_TONE[status] : "neutral"}>{t(known ? `admin.labs.stands.status.${status}` : "admin.labs.unknownState")}</Badge>
}

export function teamLabel(stand: Stand): string {
  return stand.Moderators || !stand.TeamName ? t("admin.labs.moderatorsTeam") : stand.TeamName
}

export const STAND_KIND_FILTERS = ["event", "moderators"] as const


const TEST_LAB_STATUS_TONE: Record<string, BadgeTone> = { queued: "warn", creating: "warn", ready: "ok", failed: "danger", unknown: "neutral" }

export function TestLabStatusBadge({ status }: { status: string }) {
  const known = status in TEST_LAB_STATUS_TONE
  return <Badge size="sm" tone={TEST_LAB_STATUS_TONE[known ? status : "unknown"]}>{t(`admin.labs.testLabs.status.${known ? status : "unknown"}`)}</Badge>
}

export function testLabAuthor(lab: TestLab): string {
  return lab.AuthorName || lab.AuthorEmail
}

